import { neon, types } from "@neondatabase/serverless";

types.setTypeParser(20, value => {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Postgres integer exceeds safe JavaScript range.");
  return result;
});

export function sqlClient() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Run neon deploy.");
  return neon(process.env.DATABASE_URL, { fullResults: true });
}

// Parameterized PostgreSQL statements. This small interface preserves the
// existing route result shape; queries and transactions execute on Neon HTTP.
class Statement {
  constructor(readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.sql, values); }
  query(client: ReturnType<typeof sqlClient>) { return client.query(this.sql, this.values); }
  async all<T = Record<string, unknown>>() {
    const result = await this.query(sqlClient());
    return { results: result.rows as T[], meta: { changes: result.rowCount ?? 0 } };
  }
  async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; }
  async run() { return this.all(); }
}

export const database = {
  prepare(sql: string) { return new Statement(sql); },
  async batch(statements: Statement[]) {
    if (!statements.length) return [];
    const client = sqlClient();
    const results = await client.transaction(statements.map(statement => statement.query(client)));
    return results.map(result => ({ results: result.rows, meta: { changes: result.rowCount ?? 0 } }));
  },
};
