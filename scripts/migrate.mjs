import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (fill it in .env.local)");
  process.exit(1);
}

const sql = neon(url);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

try {
  for (const statement of statements) await sql.query(statement);
  const rows = await sql.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  console.log(`schema applied, tables: ${rows.map((r) => r.table_name).join(", ")}`);
} catch (error) {
  console.error("migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
