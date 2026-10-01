const path = require('path');

function createDbConnection() {
    // Database Selection Architecture:
    // Defaults to 'sqlite' for local development.
    // Set DB_CLIENT=postgres (or NODE_ENV=production with DATABASE_URL) for PostgreSQL.
    const dbClient = (process.env.DB_CLIENT || (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();
    const usePostgres = dbClient === 'postgres' && Boolean(process.env.DATABASE_URL);

    if (dbClient === 'postgres' && !process.env.DATABASE_URL) {
        console.error('[DATABASE CONFIG ERROR] DB_CLIENT is set to "postgres" but DATABASE_URL is not set. Falling back to SQLite.');
    }

    if (usePostgres) {
        console.log('Connecting to PostgreSQL database (Production / PostgreSQL Mode)...');
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
        });

        // Translate sqlite ? params to postgres $1, $2 params
        const translateQuery = (sql) => {
            let i = 1;
            return sql.replace(/\?/g, () => `$${i++}`);
        };

        const db = {
            run: function(sql, params, callback) {
                if (typeof params === 'function') {
                    callback = params;
                    params = [];
                }
                
                let pgSql = translateQuery(sql);
                
                // Polyfill SQLite syntax to PostgreSQL syntax dynamically for schema initialization
                if (pgSql.toUpperCase().includes('CREATE TABLE')) {
                    pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
                    pgSql = pgSql.replace(/DATETIME/gi, 'TIMESTAMP');
                    pgSql = pgSql.replace(/REAL/gi, 'NUMERIC');
                }

                // Check for INSERT query to emulate SQLite's this.lastID via RETURNING id
                const isInsert = /^\s*INSERT\s+INTO\s+/i.test(pgSql);
                const hasReturning = /\bRETURNING\b/i.test(pgSql);
                if (isInsert && !hasReturning) {
                    pgSql = pgSql.trim().replace(/;?\s*$/, '') + ' RETURNING id;';
                }

                pool.query(pgSql, params || [])
                    .then(res => {
                        const lastID = (res.rows && res.rows[0] && res.rows[0].id) ? res.rows[0].id : null;
                        if (callback) callback.call({ changes: res.rowCount, lastID: lastID }, null);
                    })
                    .catch(err => {
                        // If RETURNING id failed because table has no id column, retry with original query
                        if (isInsert && !hasReturning && err.message && err.message.includes('column "id" does not exist')) {
                            const fallbackSql = translateQuery(sql);
                            pool.query(fallbackSql, params || [])
                                .then(res => {
                                    if (callback) callback.call({ changes: res.rowCount }, null);
                                })
                                .catch(fallbackErr => {
                                    if (callback) callback(fallbackErr);
                                    else console.error("Database run error:", fallbackErr.message);
                                });
                            return;
                        }
                        if (callback) {
                            callback(err);
                        } else {
                            console.error("Database run error:", err.message, "SQL:", pgSql);
                        }
                    });
                return this;
            },
            get: function(sql, params, callback) {
                if (typeof params === 'function') {
                    callback = params;
                    params = [];
                }
                const pgSql = translateQuery(sql);
                pool.query(pgSql, params || [])
                    .then(res => {
                        if (callback) callback(null, res.rows[0]);
                    })
                    .catch(err => {
                        if (callback) callback(err);
                    });
                return this;
            },
            all: function(sql, params, callback) {
                if (typeof params === 'function') {
                    callback = params;
                    params = [];
                }
                const pgSql = translateQuery(sql);
                pool.query(pgSql, params || [])
                    .then(res => {
                        if (callback) callback(null, res.rows);
                    })
                    .catch(err => {
                        if (callback) callback(err);
                    });
                return this;
            },
            serialize: function(callback) {
                callback();
                return this;
            },
            prepare: function(sql) {
                const pgSql = translateQuery(sql);
                return {
                    run: function(...args) {
                        let callback;
                        let params = args;
                        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
                            callback = args.pop();
                        }
                        if (params.length === 1 && Array.isArray(params[0])) {
                            params = params[0];
                        }
                        pool.query(pgSql, params)
                            .then(res => { if(callback) callback(null); })
                            .catch(err => { if(callback) callback(err); });
                    },
                    finalize: function() {}
                };
            }
        };

        return db;
    } else {
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = path.join(__dirname, 'bookings.db');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error connecting to SQLite database:', err);
            } else {
                console.log('Connected to SQLite database (Local Development).');
            }
        });
        return db;
    }
}

module.exports = createDbConnection();
