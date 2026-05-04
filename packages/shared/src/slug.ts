// Shop-name → URL slug. SPRINT_1 §6: lowercase, ASCII-fold, hyphenate.
// Pure function; collision retry with a random suffix lives in the caller.

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export interface SlugifyOptions {
  /** Max output length (default 50). */
  maxLength?: number;
  /** Returned when normalized input is empty (default 'shop'). */
  fallback?: string;
}

/**
 * Convert a shop name to a URL-safe slug.
 * "Espaço Barbearia 2025!" → "espaco-barbearia-2025"
 * "  ---  " → "shop" (fallback)
 */
export function slugify(name: string, options: SlugifyOptions = {}): string {
  const maxLength = options.maxLength ?? 50;
  const fallback = options.fallback ?? 'shop';

  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Random lowercase-alphanumeric suffix (default 4 chars).
 * Used to disambiguate slug collisions on org sign-up.
 * Web Crypto getRandomValues is available in Workers and Node 20+.
 */
export function randomSlugSuffix(length = 4): string {
  if (length <= 0) throw new RangeError('length must be positive');
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SUFFIX_ALPHABET[bytes[i]! % SUFFIX_ALPHABET.length];
  }
  return out;
}
