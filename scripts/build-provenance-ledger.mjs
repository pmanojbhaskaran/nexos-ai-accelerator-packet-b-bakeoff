import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const manifestPath = 'E:/Work/nexos_evidence/NEXOS_AI_ACCELERATOR_CONTROLLED_BAKEOFF_REPOSITORY_V1_P1/NEXOS_AI_ACCELERATOR_BAKEOFF_REPOSITORY_MANIFEST_V1.json';

function readJsonFile(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}

const manifest = readJsonFile(manifestPath);
const repos = {
  API: { path: 'E:/Work/nexos/nexos-courier/nexos-courier-api', head: '9a6bbcc27be4554aeee7f22f98c8c1b70ec13a4e' },
  WEB: { path: 'E:/Work/nexos/nexos-courier/nexos-courier-web', head: '23999ccba1287f19319d524b20bcff89905e5932' },
  MOBILE: { path: 'E:/Work/nexos/nexos-courier/nexos-courier-mobile', head: '5c5bbf28e104733ab185cee19d1f400726bd531a' },
  SHARED: { path: 'E:/Work/nexos/nexos-courier/nexos-courier-shared', head: 'd2e80a0eb6a5ee8c12f9a2a5c0b630e8cfe67a2d' },
};

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

function sha256File(p) {
  return sha256Buffer(fs.readFileSync(p));
}

const ledger = [];
for (const item of manifest.INCLUDE_MANIFEST) {
  const r = repos[item.SOURCE_REPO];
  const targetRel = item.TARGET_BAKEOFF_PATH.replace(/ \(tree from HEAD\)$/, '').replace(/\//g, path.sep);
  if (item.SOURCE_PATH.endsWith('/**')) {
    const prefix = item.SOURCE_PATH.slice(0, -2);
    const files = execSync(`git -C "${r.path}" ls-tree -r --name-only ${r.head} -- ${prefix}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    for (const f of files) {
      const sub = f.slice(prefix.length).replace(/^\//, '');
      const target = path.join(ROOT, targetRel, sub);
      if (!fs.existsSync(target)) continue;
      const buf = execSync(`git -C "${r.path}" show ${r.head}:${f}`);
      const targetPath = path.relative(ROOT, target).replace(/\\/g, '/');
      if (targetPath === 'pnpm-lock.yaml' || targetPath.endsWith('/pnpm-lock.yaml')) continue;
      ledger.push({
        SOURCE_REPO: item.SOURCE_REPO,
        PINNED_COMMIT: r.head,
        SOURCE_RELATIVE_PATH: f,
        SOURCE_SHA256: sha256Buffer(buf),
        TARGET_RELATIVE_PATH: targetPath,
        TARGET_SHA256: sha256File(target),
        SANITIZATION_STATUS: 'UNCHANGED',
      });
    }
    continue;
  }
  const target = path.join(ROOT, targetRel);
  if (!fs.existsSync(target)) continue;
  let status = item.SANITIZATION_REQUIRED === 'YES' ? 'SANITIZED' : 'UNCHANGED';
  if (item.SOURCE_PATH === 'src/load-env.ts') continue;
  const singleTarget = path.relative(ROOT, target).replace(/\\/g, '/');
  if (singleTarget === 'pnpm-lock.yaml' || singleTarget.endsWith('/pnpm-lock.yaml')) continue;
  try {
    const buf = execSync(`git -C "${r.path}" show ${r.head}:${item.SOURCE_PATH}`);
    ledger.push({
      SOURCE_REPO: item.SOURCE_REPO,
      PINNED_COMMIT: r.head,
      SOURCE_RELATIVE_PATH: item.SOURCE_PATH,
      SOURCE_SHA256: sha256Buffer(buf),
      TARGET_RELATIVE_PATH: path.relative(ROOT, target).replace(/\\/g, '/'),
      TARGET_SHA256: sha256File(target),
      SANITIZATION_STATUS: status,
    });
  } catch {
    /* synthetic replacement */
  }
}

for (const f of [
  'src/common/observability/otel-bootstrap.ts',
  'src/common/observability/observability-error.factory.ts',
  'src/common/auth/auth-principal.ts',
]) {
  const target = path.join(ROOT, 'api', f.replace(/\//g, path.sep));
  if (!fs.existsSync(target)) continue;
  const buf = execSync(`git -C "${repos.API.path}" show ${repos.API.head}:${f}`);
  ledger.push({
    SOURCE_REPO: 'API',
    PINNED_COMMIT: repos.API.head,
    SOURCE_RELATIVE_PATH: f,
    SOURCE_SHA256: sha256Buffer(buf),
    TARGET_RELATIVE_PATH: path.relative(ROOT, target).replace(/\\/g, '/'),
    TARGET_SHA256: sha256File(target),
    SANITIZATION_STATUS: 'UNCHANGED',
    NOTE: 'MANIFEST_CLOSURE_DEPENDENCY',
  });
}

function upsert(row) {
  const i = ledger.findIndex((r) => r.TARGET_RELATIVE_PATH === row.TARGET_RELATIVE_PATH);
  if (i >= 0) ledger[i] = { ...ledger[i], ...row };
  else ledger.push(row);
}

// main.ts adjudication
const mainTarget = path.join(ROOT, 'api/src/main.ts');
const mainSrc = execSync(`git -C "${repos.API.path}" show ${repos.API.head}:src/main.ts`);
upsert({
  SOURCE_REPO: 'API',
  PINNED_COMMIT: repos.API.head,
  SOURCE_RELATIVE_PATH: 'src/main.ts',
  SOURCE_SHA256: sha256Buffer(mainSrc),
  TARGET_RELATIVE_PATH: 'api/src/main.ts',
  TARGET_SHA256: sha256File(mainTarget),
  SANITIZATION_STATUS: 'SANITIZED',
  SANITIZATION_DESCRIPTION: 'Removed production CORS hostnames (nexos.co.in)',
});

const orgTarget = path.join(ROOT, 'web/src/lib/organization-bootstrap.ts');
const orgSrc = execSync(`git -C "${repos.WEB.path}" show ${repos.WEB.head}:src/lib/organization-bootstrap.ts`);
const orgSrcHash = sha256Buffer(orgSrc);
const orgTgtHash = sha256File(orgTarget);
upsert({
  SOURCE_REPO: 'WEB',
  PINNED_COMMIT: repos.WEB.head,
  SOURCE_RELATIVE_PATH: 'src/lib/organization-bootstrap.ts',
  SOURCE_SHA256: orgSrcHash,
  TARGET_RELATIVE_PATH: 'web/src/lib/organization-bootstrap.ts',
  TARGET_SHA256: orgTgtHash,
  SANITIZATION_STATUS: orgSrcHash === orgTgtHash ? 'UNCHANGED' : 'SANITIZED',
  SANITIZATION_DESCRIPTION:
    orgSrcHash === orgTgtHash ? undefined : 'Sanitized organization bootstrap URLs or tenant-specific literals',
});

const byTarget = new Map();
for (const row of ledger) {
  if (!row.TARGET_RELATIVE_PATH || !row.SOURCE_REPO) continue;
  if (row.SOURCE_SHA256 !== row.TARGET_SHA256 && row.SANITIZATION_STATUS === 'UNCHANGED') {
    row.SANITIZATION_STATUS = 'SANITIZED';
    row.SANITIZATION_DESCRIPTION = 'Target bytes differ from pinned source object';
  }
  byTarget.set(row.TARGET_RELATIVE_PATH, row);
}
const finalLedger = [...byTarget.values()].sort((a, b) => a.TARGET_RELATIVE_PATH.localeCompare(b.TARGET_RELATIVE_PATH));

// Reconcile against distributed source-derived files (same exclusions as seal-inventory)
const SKIP = new Set(['.git', 'node_modules', '.pnpm-store']);
function classifyForProvenance(rel) {
  if (rel.startsWith('evaluator/') || rel.startsWith('evidence/') || rel.startsWith('scripts/')) return null;
  if (
    rel === '.gitignore' ||
    rel === 'pnpm-lock.yaml' ||
    rel.endsWith('/pnpm-lock.yaml') ||
    rel.match(/^(GOVERNANCE|README|fixtures|tests|contracts|docs|docker-compose|pnpm-workspace|package\.json|\.env\.example)/) ||
    rel.startsWith('api/prisma/') ||
    rel.startsWith('api/src/app.module') ||
    rel.startsWith('api/src/load-env') ||
    rel.startsWith('api/src/modules/bakeoff-dimensioning/') ||
    rel.startsWith('api/src/common/bakeoff/') ||
    rel.startsWith('mobile/mobile-app/src/lib/bakeoff/')
  ) {
    return null;
  }
  return rel;
}
const uncovered = [];
function walkProv(dir, base = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, '/');
    if (rel.split('/').some((p) => SKIP.has(p))) continue;
    const full = path.join(dir, ent.name);
    const st = fs.lstatSync(full);
    if (st.isDirectory()) {
      walkProv(full, rel);
      continue;
    }
    if (!st.isFile()) continue;
    if (classifyForProvenance(rel) && !byTarget.has(rel)) uncovered.push(rel);
  }
}
walkProv(ROOT);
if (uncovered.length) {
  console.error('PROVENANCE_UNCOVERED=', uncovered.slice(0, 20).join(', '));
  process.exit(1);
}

const out = path.join(ROOT, 'evidence', 'COMPLETE_PROVENANCE_LEDGER.json');
fs.writeFileSync(
  out,
  JSON.stringify({ SOURCE_DERIVED_FILE_COUNT: finalLedger.length, PROVENANCE_UNCOVERED_SOURCE_FILES: 0, ledger: finalLedger }, null, 2),
);
console.log(`LEDGER_ROWS=${finalLedger.length}`);
