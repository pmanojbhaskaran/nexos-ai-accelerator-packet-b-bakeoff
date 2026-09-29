import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const evalRoot = path.resolve(import.meta.dirname, '../evaluator');
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith('.test.ts')) files.push(full);
  }
}
walk(evalRoot);
if (files.length === 0) {
  console.error('No evaluator test files found');
  process.exit(1);
}
const r = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  cwd: path.resolve(import.meta.dirname, '..'),
});
process.exit(r.status ?? 1);
