import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const inventoryPath = process.argv[2] || path.join(ROOT, 'evidence', 'FINAL_INVENTORY.json');
const outZip = process.argv[3];
if (!outZip) {
  console.error('Usage: node create-distribution-archive.mjs <inventory.json> <out.zip>');
  process.exit(1);
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8').replace(/^\uFEFF/, ''));
const staging = path.join(ROOT, 'evidence', '.archive_staging');
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

for (const row of inventory.rows) {
  const src = path.join(ROOT, row.RELATIVE_PATH.replace(/\//g, path.sep));
  const dest = path.join(staging, row.RELATIVE_PATH.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
if (inventory.INVENTORY_RELATIVE_PATH) {
  const invSrc = path.join(ROOT, inventory.INVENTORY_RELATIVE_PATH.replace(/\//g, path.sep));
  const invDest = path.join(staging, inventory.INVENTORY_RELATIVE_PATH.replace(/\//g, path.sep));
  if (fs.existsSync(invSrc)) {
    fs.mkdirSync(path.dirname(invDest), { recursive: true });
    fs.copyFileSync(invSrc, invDest);
  }
}

fs.mkdirSync(path.dirname(outZip), { recursive: true });
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
const ps = spawnSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${outZip.replace(/'/g, "''")}' -Force`,
  ],
  { stdio: 'inherit' },
);
if (ps.status !== 0) process.exit(ps.status ?? 1);

const buf = fs.readFileSync(outZip);
const sha = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
fs.writeFileSync(`${outZip}.sha256`, `${sha}\n`);
console.log(`ARCHIVE_SHA256=${sha}`);
console.log(`ARCHIVE_PATH=${outZip}`);
