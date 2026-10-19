import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Stage files downloaded through the owner's authenticated Sites session.
const downloadRoot = path.resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Provide the directory containing the downloaded source files');
const root = path.resolve('outputs/sites-import');
const source = JSON.parse(await fs.readFile(path.join(root, 'source-data.json'), 'utf8'));
await fs.mkdir(path.join(root, 'files'), { recursive: true });
const manifest = [];
for (const table of ['project_assets', 'lead_assets']) for (const asset of source.tables[table]) {
  assert.equal(path.basename(asset.file_name), asset.file_name, 'Unsafe source filename');
  const bytes = await fs.readFile(path.join(downloadRoot, asset.file_name));
  assert.equal(bytes.length, asset.size_bytes, `Size mismatch: ${asset.id}`);
  const local = `files/${asset.id}.bin`;
  await fs.writeFile(path.join(root, local), bytes);
  manifest.push({ table, id: asset.id, objectKey: asset.object_key, local, size: bytes.length, contentType: asset.content_type, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await fs.writeFile(path.join(root, 'attachments.json'), JSON.stringify(manifest, null, 2));
console.log(`PASS ${manifest.length} source attachments staged with exact source sizes and SHA-256 fingerprints.`);
