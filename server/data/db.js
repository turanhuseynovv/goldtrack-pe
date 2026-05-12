// =============================================================
// GoldTrack PE — Database Access Layer
// =============================================================
// Manages MySQL connection pool with environment-based config.
// Supports both schema initialization and runtime queries.
// =============================================================

import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

// ---- Connection Config (from .env) ----
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT) || 3306,
    multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'goldtrack_pe';

// Global connection pool (singleton)
let pool;

/**
 * Execute a SQL query against the active connection pool.
 * Automatically trims and normalizes multi-line SQL strings.
 *
 * @param {string} sql   - SQL statement (may contain newlines)
 * @param {Array}  params - Parameterized query values
 * @returns {Promise<Array>} Result rows
 */
export async function query(sql, params = []) {
    if (!pool) {
        throw new Error(
            "Database connection not established. Call initializeDatabase() first."
        );
    }

    // Normalize multi-line SQL into a single clean statement
    const cleanSql = sql
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(" ")
        .trim();

    try {
        const [rows] = await pool.execute(cleanSql, params);
        return rows;
    } catch (err) {
        console.error("❌ SQL Query Error:", err.message);
        throw new Error(`DB Error: ${err.message}`);
    }
}

/**
 * Initialize the database: create DB if missing, establish pool,
 * then run schema DDL + seed data using IF NOT EXISTS guards.
 *
 * Unlike the previous version, this does NOT drop existing tables
 * on every restart — data persists across server restarts.
 *
 * @param {string} schemaSqlContent - Full contents of schema.sql
 */
export async function initializeDatabase(schemaSqlContent) {
    console.log("⏳ Establishing MySQL connection...");

    // 1) Ensure the database exists
    const tempPool = mysql
        .createPool({ ...dbConfig, database: "" })
        .promise();

    try {
        await tempPool.execute(
            `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`
        );
        console.log(`✅ Database '${DB_NAME}' ready.`);
    } finally {
        await tempPool.end();
    }

    // 2) Create the main connection pool
    pool = mysql
        .createPool({ ...dbConfig, database: DB_NAME })
        .promise();

    // 3) Run schema DDL + seed statements
    try {
        const conn = await pool.getConnection();

        const statements = schemaSqlContent
            .split(";")
            .map(s => s.trim())
            .filter(s => s.length > 0)
            // Filter out pure comment blocks
            .filter(s => !s.split("\n").every(line => line.trim().startsWith("--") || line.trim() === ""));

        for (const stmt of statements) {
            // Use query() not execute() — DDL/SET commands aren't compatible with prepared statements
            await conn.query(stmt);
        }

        conn.release();
        console.log("✅ Schema loaded successfully.");
    } catch (err) {
        throw new Error("Schema initialization error: " + err.message);
    }
}
