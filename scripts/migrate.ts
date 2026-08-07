import { readFile } from "node:fs/promises";
import { Pool } from "pg";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local first.");
  }

  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  const pool = new Pool({ connectionString });

  try {
    await pool.query(schema);
    console.info("Database schema is up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database migration failed. Check DATABASE_URL and PostgreSQL availability.");
  process.exitCode = 1;
});
