const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("Please set DATABASE_URL environment variable to your PostgreSQL connection string.");
    console.error("Example: set DATABASE_URL=postgres://user:pass@host/db node migrate_to_postgres.js");
    process.exit(1);
}

const sqliteDb = new sqlite3.Database(path.join(__dirname, 'bookings.db'));
const pgClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
    try {
        await pgClient.connect();
        console.log("Connected to PostgreSQL.");
        
        console.log("\nNOTE: Ensure you have started the application with DATABASE_URL at least once so the PostgreSQL schema is created before running this migration.\n");
        
        const tables = ['categories', 'packages_new', 'package_services', 'admins', 'enquiries', 'admin_notes', 'bookings'];
        
        for (const table of tables) {
            console.log(`Migrating table: ${table}...`);
            const rows = await new Promise((resolve, reject) => {
                sqliteDb.all(`SELECT * FROM ${table}`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`Found ${rows.length} rows in SQLite ${table}.`);
            if (rows.length === 0) continue;
            
            // Clear target table safely
            await pgClient.query(`TRUNCATE TABLE ${table} CASCADE`);
            
            for (const row of rows) {
                const keys = Object.keys(row);
                const values = Object.values(row);
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                
                const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
                await pgClient.query(query, values);
            }
            console.log(`Successfully migrated ${table}.`);
        }
        
        console.log("\nData migration complete!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
