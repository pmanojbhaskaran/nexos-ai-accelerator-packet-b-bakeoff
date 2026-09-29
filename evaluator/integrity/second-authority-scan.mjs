import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROHIBITED = {
  mysql2: 'PROHIBITED_DB_CLIENT',
  mongodb: 'PROHIBITED_DB_CLIENT',
  mongoose: 'PROHIBITED_DB_CLIENT',
  'better-sqlite3': 'PROHIBITED_DB_CLIENT',
  'firebase-admin': 'PROHIBITED_DB_CLIENT',
  '@supabase/supabase-js': 'PROHIBITED_DB_CLIENT',
  '@azure/cosmos': 'PROHIBITED_CLOUD_BACKEND',
  '@google-cloud/firestore': 'PROHIBITED_CLOUD_BACKEND',
  '@clerk/backend': 'PROHIBITED_AUTH_PROVIDER',
  passport: 'PROHIBITED_AUTH_PROVIDER',
  openai: 'PROHIBITED_AI_RUNTIME',
  '@anthropic-ai/sdk': 'PROHIBITED_AI_RUNTIME',
  langchain: 'PROHIBITED_AI_RUNTIME',
};

const ALLOWED_NON_AUTHORITY = new Set([
  'tsx', 'typescript', 'jest', 'vitest', '@types/node', 'eslint', 'prettier',
  'react', 'react-dom', 'next', 'expo', 'expo-camera', '@nestjs/common', '@nestjs/core',
  '@prisma/client', 'prisma',
]);

export function classifyAddedDependency(name) {
  if (PROHIBITED[name]) {
    return { name, classification: 'PROHIBITED_SECOND_AUTHORITY', code: PROHIBITED[name] };
  }
  if (ALLOWED_NON_AUTHORITY.has(name)) {
    return { name, classification: 'ALLOWED', code: 'ALLOWED_NON_AUTHORITY' };
  }
  if (/prisma|typeorm|sequelize|knex|pg\b|postgres/i.test(name) && name !== '@prisma/client' && name !== 'prisma') {
    return { name, classification: 'REVIEW_REQUIRED', code: 'REVIEW_REQUIRED_AUTHORITY_DELTA' };
  }
  return { name, classification: 'REVIEW_REQUIRED', code: 'REVIEW_REQUIRED_AUTHORITY_DELTA' };
}

function classifyName(name) {
  return classifyAddedDependency(name);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}

function depsOf(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return [];
  const pkg = readJson(p);
  return [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
}

const WORKSPACES = [
  { id: 'root', manifest: 'package.json' },
  { id: 'api', manifest: 'api/package.json' },
  { id: 'web', manifest: 'web/package.json' },
  { id: 'mobile', manifest: 'mobile/mobile-app/package.json' },
  { id: 'shared', manifest: 'shared/package.json' },
];

export function scanAuthorityDelta(baseline, candidateRoot) {
  const findings = [];
  for (const ws of WORKSPACES) {
    const before = new Set(baseline.dependencies?.[ws.id] || []);
    const after = depsOf(candidateRoot, ws.manifest);
    for (const name of after) {
      if (before.has(name)) continue;
      const classified = classifyName(name);
      findings.push({ workspace: ws.id, kind: 'DEPENDENCY', ...classified });
    }
  }
  const schema = path.join(candidateRoot, 'api/prisma/schema.prisma');
  if (fs.existsSync(schema)) {
    const text = fs.readFileSync(schema, 'utf8');
    if (/datasource\s+\w+\s*\{[^}]*url\s*=\s*env\("(?!DATABASE_URL")/s.test(text) || /provider\s*=\s*"(mysql|sqlite|mongodb)"/.test(text)) {
      findings.push({ workspace: 'api', kind: 'PRISMA', name: 'schema.prisma', classification: 'PROHIBITED_SECOND_AUTHORITY', code: 'NEW_PRISMA_AUTHORITY' });
    }
    if (baseline.prismaSchemaSha256) {
      const sha = crypto.createHash('sha256').update(fs.readFileSync(schema)).digest('hex').toUpperCase();
      if (sha !== baseline.prismaSchemaSha256 && /model\s+Accelerator/.test(text)) {
        findings.push({ workspace: 'api', kind: 'PRISMA', name: 'AcceleratorModel', classification: 'PROHIBITED_SECOND_AUTHORITY', code: 'NEW_PRISMA_AUTHORITY' });
      }
    }
  }
  const envExample = path.join(candidateRoot, '.env.example');
  if (fs.existsSync(envExample)) {
    const env = fs.readFileSync(envExample, 'utf8');
    if (/ACCELERATOR_DATABASE_URL|SECOND_DATABASE_URL|CLERK_SECRET/.test(env)) {
      findings.push({ workspace: 'root', kind: 'DB_CONFIG', name: 'env', classification: 'PROHIBITED_SECOND_AUTHORITY', code: 'NEW_DB_OR_AUTH_CONFIG' });
    }
  }
  function walk(dir, base = '') {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      const rel = path.join(base, ent.name).replace(/\\/g, '/');
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, rel);
      else if (ent.name.endsWith('.controller.ts') && /accelerator|parallel-api/i.test(ent.name)) {
        findings.push({ workspace: 'api', kind: 'ROUTE', name: rel, classification: 'PROHIBITED_SECOND_AUTHORITY', code: 'PARALLEL_API_ROUTE' });
      } else if (/\.(ts|tsx|js|yml|yaml|json)$/.test(ent.name)) {
        const sample = fs.readFileSync(full, 'utf8').slice(0, 4000);
        if (/https?:\/\/(api\.openai\.com|generativelanguage\.googleapis\.com)/.test(sample)) {
          findings.push({ workspace: 'api', kind: 'ENDPOINT', name: rel, classification: 'PROHIBITED_SECOND_AUTHORITY', code: 'NEW_AI_OR_EXTERNAL_ENDPOINT' });
        }
        if (/vendor-metadata\.json|ACCELERATOR_VENDOR/.test(ent.name + sample.slice(0, 200))) {
          findings.push({ workspace: 'root', kind: 'VENDOR_METADATA', name: rel, classification: 'REVIEW_REQUIRED', code: 'REVIEW_REQUIRED_AUTHORITY_DELTA' });
        }
      }
    }
  }
  walk(path.join(candidateRoot, 'api/src'));
  if (fs.existsSync(path.join(candidateRoot, 'vendor-metadata.json'))) {
    findings.push({ workspace: 'root', kind: 'VENDOR_METADATA', name: 'vendor-metadata.json', classification: 'REVIEW_REQUIRED', code: 'REVIEW_REQUIRED_AUTHORITY_DELTA' });
  }
  const unresolved = findings.filter((f) => f.classification !== 'ALLOWED');
  return {
    findings,
    pass: unresolved.length === 0,
    code: unresolved.some((f) => f.classification === 'PROHIBITED_SECOND_AUTHORITY')
      ? 'PROHIBITED_SECOND_AUTHORITY'
      : unresolved.length
        ? 'REVIEW_REQUIRED_AUTHORITY_DELTA'
        : 'AUTHORITY_DELTA_CLEAN',
  };
}

export function buildDependencyBaseline(candidateRoot) {
  const dependencies = {};
  for (const ws of WORKSPACES) dependencies[ws.id] = depsOf(candidateRoot, ws.manifest).sort();
  const schema = path.join(candidateRoot, 'api/prisma/schema.prisma');
  return {
    dependencies,
    prismaSchemaSha256: fs.existsSync(schema)
      ? crypto.createHash('sha256').update(fs.readFileSync(schema)).digest('hex').toUpperCase()
      : null,
  };
}
