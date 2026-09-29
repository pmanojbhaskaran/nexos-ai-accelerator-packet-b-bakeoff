export type DependencyClassification = 'ALLOWED' | 'REVIEW_REQUIRED' | 'PROHIBITED_SECOND_AUTHORITY';

export type DependencyDelta = {
  name: string;
  classification: DependencyClassification;
  reason: string;
};

const PROHIBITED_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /^(mongoose|firebase-admin|@supabase\/supabase-js)$/i, tag: 'NEW_DATASTORE_CLIENT' },
  { re: /^@aws-sdk\/client-/i, tag: 'NEW_CLOUD_BACKEND' },
  { re: /^(openai|@anthropic-ai|langchain|@google\/generative-ai)$/i, tag: 'NEW_AI_RUNTIME_DEPENDENCY' },
];

const AUTH_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /^(passport|@auth0|firebase-auth|supabase-auth-helpers)$/i, tag: 'NEW_AUTH_PROVIDER' },
];

export function classifyAddedDependency(name: string): DependencyDelta {
  for (const p of PROHIBITED_PATTERNS) {
    if (p.re.test(name)) {
      return { name, classification: 'PROHIBITED_SECOND_AUTHORITY', reason: p.tag };
    }
  }
  for (const p of AUTH_PATTERNS) {
    if (p.re.test(name)) {
      return { name, classification: 'PROHIBITED_SECOND_AUTHORITY', reason: p.tag };
    }
  }
  if (/prisma/.test(name) && name !== '@prisma/client') {
    return { name, classification: 'REVIEW_REQUIRED', reason: 'PRISMA_RELATED_DEPENDENCY' };
  }
  return { name, classification: 'ALLOWED', reason: 'DEFAULT_ALLOW_WITH_REVIEW' };
}

export function diffDependencySets(baseline: string[], candidate: string[]): DependencyDelta[] {
  const base = new Set(baseline);
  return candidate.filter((d) => !base.has(d)).map((name) => classifyAddedDependency(name));
}

export function hasProhibitedSecondAuthority(deltas: DependencyDelta[]): boolean {
  return deltas.some((d) => d.classification === 'PROHIBITED_SECOND_AUTHORITY');
}
