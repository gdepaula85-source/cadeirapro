// Pix key format validation. Format-only — no checksum, no DICT lookup.
// TODO(s3): real DICT lookup via Transfeera.
//
// Per SPRINT_1 §0.7: Pix-key validation in S1 = format-only regex. Real DICT
// lookup deferred to S3 with Transfeera.

export const PIX_KEY_TYPES = ['cpf', 'cnpj', 'email', 'phone', 'random'] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

const CPF_RE = /^\d{11}$/;
const CNPJ_RE = /^\d{14}$/;
// Email — RFC 5322 simplified, sufficient for sign-up time format check.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// E.164: leading "+", country code 1-9, total 1-15 digits after "+".
const PHONE_RE = /^\+[1-9]\d{1,14}$/;
// Pix random key format is a UUID v4 (per BCB spec).
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Format-only validation of a Pix key against its declared type.
 * Returns true on shape match; does NOT verify the key exists at DICT.
 */
export function validatePixKeyFormat(key: string, type: PixKeyType): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  switch (type) {
    case 'cpf':
      return CPF_RE.test(key);
    case 'cnpj':
      return CNPJ_RE.test(key);
    case 'email':
      return EMAIL_RE.test(key) && key.length <= 254;
    case 'phone':
      return PHONE_RE.test(key);
    case 'random':
      return UUID_V4_RE.test(key);
  }
}

export function isPixKeyType(value: unknown): value is PixKeyType {
  return typeof value === 'string' && (PIX_KEY_TYPES as readonly string[]).includes(value);
}
