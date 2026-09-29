import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const EVIDENCE = process.argv[2] || 'E:/Work/nexos_evidence/NEXOS_AI_ACCELERATOR_CONTROLLED_BAKEOFF_REPOSITORY_V1_P2_REPAIR_V2';
const evalRoot = path.join(ROOT, 'evaluator');

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
}

const files = [];
function walk(dir, base = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, ent.name).replace(/\\/g, '/');
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, rel);
    else {
      files.push({
        relative_path: `evaluator/${rel}`,
        byte_size: fs.statSync(full).size,
        sha256: hashFile(full),
      });
    }
  }
}
walk(evalRoot);
files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));

fs.mkdirSync(EVIDENCE, { recursive: true });
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
const baseline = {
  generated: new Date().toISOString(),
  candidate_repo: ROOT,
  authoritative: true,
  candidate_evaluator_command: pkg.scripts?.['test:evaluator'] ?? '',
  files,
};
const baselinePath = path.join(EVIDENCE, 'EVALUATOR_EXTERNAL_BASELINE_SHA256.json');
fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

const runnerPath = path.join(EVIDENCE, 'evaluator-runner.mjs');
if (!fs.existsSync(runnerPath)) {
  console.error('evaluator-runner.mjs must exist in evidence root before hashing');
  process.exit(1);
}
const runnerSha = hashFile(runnerPath);
fs.writeFileSync(path.join(EVIDENCE, 'EVALUATOR_EXTERNAL_RUNNER_SHA256.txt'), `${runnerSha}\n`);

console.log(`EXTERNAL_BASELINE_FILES=${files.length}`);
console.log(`EXTERNAL_BASELINE_SHA256=${hashFile(baselinePath)}`);
console.log(`EXTERNAL_RUNNER_SHA256=${runnerSha}`);
