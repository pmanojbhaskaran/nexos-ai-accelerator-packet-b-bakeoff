import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.argv[2] || path.resolve(import.meta.dirname, '..');
const invPath = process.argv[3] || path.join(ROOT, 'evidence', 'FINAL_INVENTORY.json');
const inv = JSON.parse(fs.readFileSync(invPath, 'utf8').replace(/^\uFEFF/, ''));

let hashMismatch = 0;
let absent = 0;
const invRel = path.relative(ROOT, invPath).replace(/\\/g, '/');
for (const row of inv.rows) {
  if (row.RELATIVE_PATH === invRel) continue;
  const full = path.join(ROOT, row.RELATIVE_PATH.replace(/\//g, path.sep));
  if (!fs.existsSync(full)) {
    absent++;
    continue;
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').toUpperCase();
  if (sha !== row.SHA256) hashMismatch++;
}

const distributed = inv.DISTRIBUTED_FILE_COUNT ?? inv.rows.length;
console.log(`INVENTORY_ROW_COUNT=${inv.rows.length}`);
console.log(`DISTRIBUTED_FILE_COUNT=${distributed}`);
console.log(`HASH_MISMATCH_COUNT=${hashMismatch}`);
console.log(`ABSENT_INVENTORY_PATH_COUNT=${absent}`);
if (hashMismatch || absent) process.exit(1);
if (distributed !== inv.rows.length + (inv.INVENTORY_SELF_ROW_EXCLUDED ? 1 : 0)) {
  console.error('DISTRIBUTED_FILE_COUNT mismatch');
  process.exit(1);
}
