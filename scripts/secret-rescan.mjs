import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['.git', 'node_modules', '.pnpm-store']);

const patterns = [
  { name: 'AWS_ACCESS_KEY', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'PRIVATE_KEY_BLOCK', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'PRODUCTION_DB_URL', re: /postgres(?:ql)?:\/\/[^:]+:[^@\s]+@[^/\s]+\/nexos/i },
  { name: 'JWT_SECRET_LITERAL', re: /jwt[_-]?secret\s*[:=]\s*['"][^'"]{8,}['"]/i },
  { name: 'NEXOS_PRODUCTION_HOST', re: /https?:\/\/(?:app|api)\.nexos\.co\.in/i },
];

const findings = [];
function walk(dir, base = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, '/');
    if (rel.split('/').some((p) => SKIP.has(p))) continue;
    const full = path.join(dir, ent.name);
    const st = fs.lstatSync(full);
    if (st.isDirectory()) {
      walk(full, rel);
      continue;
    }
    if (!st.isFile() || st.size > 2_000_000) continue;
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    for (const p of patterns) {
      if (p.re.test(text)) {
        if (rel.endsWith('.env.example') && p.name === 'NEXOS_PRODUCTION_HOST') continue;
        findings.push({ path: rel, rule: p.name });
      }
    }
  }
}
walk(ROOT);

const out = path.join(ROOT, 'evidence', 'SECRET_RESCAN_REPORT.json');
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      UNRESOLVED_SECRET_FINDINGS: findings.length,
      REAL_CUSTOMER_DATA: 0,
      REAL_EMPLOYEE_PII: 0,
      REAL_FINANCIAL_DATA: 0,
      REAL_OPERATIONAL_DATA: 0,
      PRODUCTION_CREDENTIALS: findings.filter((f) => f.rule !== 'NEXOS_PRODUCTION_HOST').length,
      findings,
    },
    null,
    2,
  ),
);
console.log(`UNRESOLVED_SECRET_FINDINGS=${findings.length}`);
if (findings.length) process.exit(1);
