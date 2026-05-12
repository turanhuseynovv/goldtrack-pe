import { query, initializeDatabase } from "./data/db.js";
import fs from "fs";
import { join } from "path";

async function resetData() {
    try {
        console.log("Loading schema...");
        const schemaPath = join(process.cwd(), "server", "schema.sql");
        const schemaSqlContent = fs.readFileSync(schemaPath, "utf8");
        await initializeDatabase(schemaSqlContent); // This connects and creates tables if they don't exist
        
        console.log("Dropping tables to apply new schema...");
        await query("SET FOREIGN_KEY_CHECKS = 0;");
        await query("DROP TABLE IF EXISTS decision_audit;");
        await query("DROP TABLE IF EXISTS mine_metrics;");
        await query("SET FOREIGN_KEY_CHECKS = 1;");
        
        // Re-run the initialization to actually create the tables we just dropped
        console.log("Re-creating tables...");
        await initializeDatabase(schemaSqlContent);

        console.log("Database reset successfully. Ready for server start.");
        process.exit(0);
    } catch (e) {
        console.error("Reset failed:", e);
        process.exit(1);
    }
}

resetData();
