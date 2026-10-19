import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

// Run with --env-file=.env.local. The default is an inspection-only dry run.
const apply = process.argv.includes('--apply');
const root = path.resolve('outputs/sites-import');
const source = JSON.parse(await fs.readFile(path.join(root, 'source-data.json'), 'utf8'));
const sql = neon(process.env.DATABASE_URL);
const order = ['contacts', 'team_members', 'task_columns', 'work_items', 'invoices', 'finance_budgets', 'marketing_posts', 'project_deliverables', 'task_generations', 'task_updates', 'lead_assets', 'project_assets'];
assert.deepEqual(Object.keys(source.tables).sort(), [...order].sort(), 'Unexpected source tables');
const primaryKeys = { finance_budgets: ['month', 'currency'], task_generations: ['source_key'] };
const quote = value => { assert.match(value, /^[a-z_]+$/); return `"${value}"`; };
const key = (table, row) => JSON.stringify((primaryKeys[table] || ['id']).map(c => row[c]));
const target = {};
for (const table of order) target[table] = await sql.query(`SELECT * FROM ${quote(table)}`);
const identities = await sql`SELECT id, email FROM neon_auth."user"`;
const identityMap = new Map();
for (const member of source.tables.team_members) {
  const auth = identities.find(r => r.email.toLowerCase() === member.email.toLowerCase());
  const existing = target.team_members.find(r => r.id === auth?.id) || target.team_members.find(r => r.email.toLowerCase() === member.email.toLowerCase());
  if (existing) identityMap.set(member.id, existing.id);
}
const tables = structuredClone(source.tables);
for (const row of tables.team_members) row.id = identityMap.get(row.id) || row.id;
for (const row of tables.work_items) row.task_assignee_id = identityMap.get(row.task_assignee_id) || row.task_assignee_id;
for (const table of ['project_assets', 'lead_assets']) for (const row of tables[table]) row.uploaded_by = identityMap.get(row.uploaded_by) || row.uploaded_by;

const plan = [], conflicts = [], expected = {};
for (const table of order) {
  const known = new Map(target[table].map(row => [key(table, row), row]));
  const columns = (await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=${table}`).map(r => r.column_name);
  expected[table] = [];
  let inserted = 0, skipped = 0;
  for (const row of tables[table]) {
    for (const column of Object.keys(row)) assert.ok(columns.includes(column), `Unmapped column ${table}.${column}`);
    const found = known.get(key(table, row));
    // An existing identity retains its local profile, role, and last-seen value.
    if (table === 'team_members' && found) { skipped++; continue; }
    expected[table].push(row);
    if (found) {
      const differences = Object.keys(row).filter(c => String(found[c] ?? '') !== String(row[c] ?? ''));
      if (differences.length) conflicts.push({ table, key: key(table, row), columns: differences });
      skipped++;
    } else {
      const cols = Object.keys(row);
      plan.push({ table, row, query: `INSERT INTO ${quote(table)} (${cols.map(quote).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`, params: cols.map(c => row[c]) });
      inserted++;
    }
  }
  console.log(`${table}: source=${tables[table].length}, existing=${target[table].length}, add=${inserted}, already present=${skipped}`);
}
console.log(`Identity links matched by email: ${identityMap.size}`);
if (conflicts.length) { console.log(JSON.stringify(conflicts, null, 2)); throw Error('Conflicting records require resolution; no writes performed'); }
if (!apply) { console.log('PASS dry run: no conflicting IDs or unmapped fields; no database changes.'); process.exit(0); }

const manifest = JSON.parse(await fs.readFile(path.join(root, 'attachments.json'), 'utf8'));
assert.equal(manifest.length, tables.project_assets.length + tables.lead_assets.length, 'Missing attachment downloads');
const fileQueries = [];
for (const file of manifest) {
  const asset = tables[file.table].find(r => r.id === file.id);
  assert.ok(asset && asset.object_key === file.objectKey && asset.size_bytes === file.size);
  const bytes = await fs.readFile(path.join(root, file.local));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  const existing = await sql`SELECT encode(sha256(data),'hex') AS hash FROM stored_files WHERE object_key=${file.objectKey}`;
  if (existing.length) assert.equal(existing[0].hash, file.sha256, 'Existing attachment differs');
  else fileQueries.push(sql`INSERT INTO stored_files(object_key,content_type,data,created_at) VALUES(${file.objectKey},${file.contentType},decode(${bytes.toString('hex')},'hex'),${asset.uploaded_at}) ON CONFLICT DO NOTHING`);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await fs.writeFile(path.join(root, `target-before-${stamp}.json`), JSON.stringify({ tables: target }, null, 2));
const queries = [...fileQueries, ...plan.map(p => sql.query(p.query, p.params))];
// Advance invoice numbering without changing or removing an existing invoice.
queries.push(sql`SELECT setval(pg_get_serial_sequence('public.invoices','id'), GREATEST(COALESCE((SELECT max(id) FROM invoices),1), (SELECT last_value FROM invoices_id_seq)), true)`);
await sql.transaction(queries);

const report = { importedAt: new Date().toISOString(), projectId: source.projectId, identityLinks: identityMap.size, added: {}, verified: {}, files: [] };
for (const table of order) {
  const rows = await sql.query(`SELECT * FROM ${quote(table)}`);
  const known = new Map(rows.map(r => [key(table, r), r]));
  for (const row of expected[table]) {
    const actual = known.get(key(table, row));
    assert.ok(actual, `${table}: missing imported row`);
    for (const col of Object.keys(row)) assert.equal(String(actual[col] ?? ''), String(row[col] ?? ''), `${table}.${col}: imported value differs`);
  }
  for (const original of target[table]) assert.deepEqual(known.get(key(table, original)), original, `${table}: pre-existing record changed`);
  report.added[table] = plan.filter(p => p.table === table).length;
  report.verified[table] = expected[table].length;
  console.log(`PASS ${table}: ${expected[table].length} source records verified; ${target[table].length} existing records unchanged`);
}
for (const file of manifest) {
  const [actual] = await sql`SELECT octet_length(data) AS size, encode(sha256(data),'hex') AS hash FROM stored_files WHERE object_key=${file.objectKey}`;
  assert.equal(actual.size, file.size); assert.equal(actual.hash, file.sha256);
  report.files.push({ id: file.id, bytes: file.size, sha256: file.sha256 });
}
await fs.writeFile(path.join(root, 'import-report.json'), JSON.stringify(report, null, 2));
console.log(`PASS ${manifest.length} attachment SHA-256 checks; import committed and verified.`);
