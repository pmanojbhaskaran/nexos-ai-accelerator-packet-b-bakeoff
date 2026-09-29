import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Note: FINAL_INVENTORY.json is a generated manifest and is excluded from its own row list
// to avoid self-hash bootstrap contradiction. Its SHA256 is recorded in FINAL_INVENTORY.json.sha256.

const ROOT = path.resolve(process.argv[2] || path.resolve(import.meta.dirname, '..'));
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'evidence', 'FINAL_INVENTORY.json'));
const OUT_REL = path.relative(ROOT, OUT).replace(/\\/g, '/');

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex').toUpperCase();
}

function classify(rel) {
  if (rel.startsWith('evaluator/')) return 'GENERATED_EVIDENCE';
  if (rel.startsWith('evidence/')) return 'GENERATED_EVIDENCE';
  if (rel.startsWith('scripts/')) return 'SYNTHETIC_BAKEOFF';
  if (rel === '.gitignore') return 'SYNTHETIC_BAKEOFF';
  if (rel.startsWith('mobile/mobile-app/src/lib/bakeoff/')) return 'SYNTHETIC_BAKEOFF';
  if (rel === 'pnpm-lock.yaml' || rel.endsWith('/pnpm-lock.yaml')) return 'GENERATED_BAKEOFF';
  const ledgerPath = path.join(ROOT, 'evidence', 'COMPLETE_PROVENANCE_LEDGER.json');
  if (fs.existsSync(ledgerPath)) {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^\uFEFF/, ''));
    const row = (ledger.ledger || []).find((r) => r.TARGET_RELATIVE_PATH === rel);
    if (row?.SANITIZATION_STATUS === 'SANITIZED') return 'SOURCE_DERIVED_SANITIZED';
    if (row?.SANITIZATION_STATUS === 'UNCHANGED') return 'SOURCE_DERIVED_UNCHANGED';
  }
  if (
    rel.match(/^(GOVERNANCE|README|fixtures|tests|contracts|docs|docker-compose|pnpm-workspace|package\.json|\.env\.example|scripts\/)/) ||
    rel.startsWith('api/prisma/') ||
    rel.startsWith('api/src/app.module') ||
    rel.startsWith('api/src/load-env') ||
    rel.startsWith('api/src/modules/bakeoff-dimensioning/') ||
    rel.startsWith('api/src/common/bakeoff/')
  ) {
    return 'SYNTHETIC_BAKEOFF';
  }
  if (rel === 'api/src/main.ts') return 'SOURCE_DERIVED_SANITIZED';
  if (rel === 'web/src/lib/organization-bootstrap.ts') return 'SOURCE_DERIVED_SANITIZED';
  return 'SOURCE_DERIVED_UNCHANGED';
}

const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.pnpm-store', 'dist', 'build', '.turbo', '.expo', '.archive_staging']);

function shouldSkipRel(rel) {
  const parts = rel.split('/');
  return parts.some((p) => SKIP_DIR_NAMES.has(p));
}

const rows = [];
function walk(dir, base = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, '/');
    if (rel === OUT_REL || rel === `${OUT_REL}.sha256`) continue;
    if (shouldSkipRel(rel)) continue;
    const full = path.join(dir, ent.name);
    const st = fs.lstatSync(full);
    if (st.isDirectory()) {
      walk(full, rel);
      continue;
    }
    if (!st.isFile()) continue;
    rows.push({
      RELATIVE_PATH: rel,
      BYTE_SIZE: st.size,
      SHA256: sha256File(full),
      CLASSIFICATION: classify(rel),
    });
  }
}
walk(ROOT);
rows.sort((a, b) => a.RELATIVE_PATH.localeCompare(b.RELATIVE_PATH));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const outInsideRepo = OUT.startsWith(ROOT + path.sep) || OUT === ROOT;
const distributedFileCount = outInsideRepo ? rows.length + 1 : rows.length;
const inventoryBody = {
  DISTRIBUTED_FILE_COUNT: distributedFileCount,
  INVENTORY_SELF_ROW_EXCLUDED: outInsideRepo,
  INVENTORY_RELATIVE_PATH: outInsideRepo ? OUT_REL : null,
  INVENTORY_EXTERNAL_PATH: outInsideRepo ? null : OUT,
  rows,
};
fs.writeFileSync(OUT, JSON.stringify(inventoryBody, null, 2));
const invSha = crypto.createHash('sha256').update(fs.readFileSync(OUT)).digest('hex').toUpperCase();
const invSize = fs.statSync(OUT).size;
fs.writeFileSync(`${OUT}.sha256`, `${invSha}\n`);
console.log(`INVENTORY_ROWS=${rows.length}`);
console.log(`DISTRIBUTED_FILE_COUNT=${rows.length + 1}`);
console.log(`INVENTORY_FILE_SHA256=${invSha}`);
