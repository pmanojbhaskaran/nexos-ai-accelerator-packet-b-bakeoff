import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const evalRoot = path.resolve(import.meta.dirname, '../evaluator');
const MANIFEST_REL = 'integrity/EVALUATOR_BASELINE_SHA256_MANIFEST.json';

function hashFile(full) {
  return crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').toUpperCase();
}

const rows = [];
function walk(dir, base = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, ent.name).replace(/\\/g, '/');
    if (rel === MANIFEST_REL) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, rel);
    else {
      rows.push({ path: `evaluator/${rel}`, sha256: hashFile(full), bytes: fs.statSync(full).size });
    }
  }
}
walk(evalRoot);
rows.sort((a, b) => a.path.localeCompare(b.path));

const out = path.join(evalRoot, MANIFEST_REL);
fs.mkdirSync(path.dirname(out), { recursive: true });
const payload = { generated: new Date().toISOString(), manifestSelfHashExcluded: true, files: rows };
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`EVALUATOR_FILES=${rows.length}`);
console.log(`MANIFEST_SHA256=${hashFile(out)}`);
