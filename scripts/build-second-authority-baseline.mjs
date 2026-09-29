import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function deps(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return [];
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].sort();
}

const out = {
  generated: new Date().toISOString(),
  root: deps('package.json'),
  api: deps('api/package.json'),
  web: deps('web/package.json'),
  mobile: deps('mobile/mobile-app/package.json'),
  shared: deps('shared/package.json'),
};
fs.writeFileSync(path.join(ROOT, 'evaluator/fixtures/second-authority-baseline.json'), JSON.stringify(out, null, 2));
console.log('SECOND_AUTHORITY_BASELINE_UPDATED=1');
