const path = require('path');

function createDbConnection() {
    if (process.env.DATABASE_URL) {
        console.log('Connecting to PostgreSQL database (Production Mode)...');
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Translate sqlite ? params to postgres $1, $2 params
        const translateQuery = (sql) => {
            let i = 1;
            return sql.replace(/\?/g, () => `$${i++}`);
        };

        // Queue for serialize execution
        let serializeQueue = Promise.resolve();

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

                pool.query(pgSql, params || [])
                    .then(res => {
                        if (callback) callback.call({ changes: res.rowCount }, null);
                    })
                    .catch(err => {
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
                // For PostgreSQL, serialize just executes normally since standard queries are fast enough,
                // but schema creation could technically race. Since we use IF NOT EXISTS, it's generally safe.
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
