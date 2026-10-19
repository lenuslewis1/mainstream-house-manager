import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle } from "drizzle-orm/neon-http";
import fs from "node:fs";

const connection = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8").trim() : process.env.DATABASE_URL_UNPOOLED;
if (!connection) throw new Error("DATABASE_URL_UNPOOLED is required.");
if (new URL(connection).hostname.includes("-pooler")) throw new Error("Use the direct database URL for migrations.");
const sql = neon(connection);
await migrate(drizzle(sql), { migrationsFolder: "./drizzle/neon" });
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
console.log(`PASS Neon migration: ${tables.length} public tables (${tables.map(row => row.tablename).join(", ")})`);
