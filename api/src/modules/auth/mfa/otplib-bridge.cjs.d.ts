export function generateSecret(): Promise<string>;
export function generate(params: { secret: string }): Promise<string>;
export function generateURI(params: {
  issuer: string;
  label: string;
  secret: string;
}): string;
export function verify(params: {
  secret: string;
  token: string;
  window?: number;
}): Promise<{ valid: boolean }>;
