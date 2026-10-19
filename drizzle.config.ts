import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch { /* CI may inject environment variables. */ }
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/neon",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
});
