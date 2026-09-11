import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

try {
  console.log("Running database migration...");

  await pool.query(schema);

  console.log("Database migration completed successfully.");
} catch (error) {
  console.error("Database migration failed:");
  console.error(error);
  process.exit(1);
} finally {
  await pool.end();
}
