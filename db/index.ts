import { drizzle } from "drizzle-orm/neon-http";
import { sqlClient } from "./client";
import * as schema from "./schema";
export function getDb() { return drizzle(sqlClient(), { schema }); }
