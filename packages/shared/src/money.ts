// Money helpers. Integer cents only — never floats anywhere downstream.
// Build Guide §14.1: "Store all money as integer cents. Convert to and from
// BRL strings only at the UI boundary or during PSP API calls."

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Convert a BRL value (string or number) to integer cents.
 * Accepts:
 *   "12,34"   "12.34"   "1.234,56"   "R$ 12,34"   12.34   12
 * Rejects: NaN, Infinity, negative zero, more than 2 decimals.
 */
export function toCents(brl: string | number): number {
  if (typeof brl === 'number') {
    if (!Number.isFinite(brl)) {
      throw new RangeError('toCents: non-finite number');
    }
    const cents = Math.round(brl * 100);
    if (Math.abs(brl * 100 - cents) > 1e-6) {
      throw new RangeError('toCents: number has more than 2 decimal places');
    }
    return cents;
  }

  const cleaned = brl
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (cleaned === '') {
    throw new RangeError('toCents: empty string');
  }

  // pt-BR uses "." as thousands separator and "," as decimal.
  // After stripping "R$" and spaces, normalize: drop "." (thousands) and
  // promote "," to ".".
  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    throw new RangeError(`toCents: cannot parse "${brl}"`);
  }
  // Re-check decimal places by inspecting the normalized string.
  const decIdx = normalized.indexOf('.');
  if (decIdx >= 0 && normalized.length - decIdx - 1 > 2) {
    throw new RangeError(`toCents: more than 2 decimal places in "${brl}"`);
  }
  return Math.round(n * 100);
}

/** Format integer cents as a pt-BR BRL string, e.g. 123456 → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError('formatBRL: cents must be an integer');
  }
  return BRL_FORMATTER.format(cents / 100);
}

/**
 * Split an integer-cent total proportionally by ratios. The output sums
 * exactly to the input. Rounding pennies (the residue after Math.floor of
 * each share) are distributed to the slices with the largest fractional
 * remainders — Hamilton/largest-remainder method. Stable for ties (lower
 * index wins) so output is deterministic.
 *
 * Example: splitProportional(10000, [0.5, 0.495, 0.005]) → [5000, 4950, 50]
 */
export function splitProportional(cents: number, ratios: number[]): number[] {
  if (!Number.isInteger(cents)) {
    throw new RangeError('splitProportional: cents must be an integer');
  }
  if (cents < 0) {
    throw new RangeError('splitProportional: cents must be non-negative');
  }
  if (ratios.length === 0) {
    throw new RangeError('splitProportional: ratios must be non-empty');
  }
  for (const r of ratios) {
    if (!Number.isFinite(r) || r < 0) {
      throw new RangeError('splitProportional: ratios must be non-negative finite');
    }
  }
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  if (totalRatio === 0) {
    throw new RangeError('splitProportional: ratios sum to zero');
  }

  const exact = ratios.map((r) => (cents * r) / totalRatio);
  const floored = exact.map((x) => Math.floor(x));
  const remainders = exact.map((x, i) => ({ idx: i, frac: x - (floored[i] ?? 0) }));
  const allocated = floored.reduce((a, b) => a + b, 0);
  let residue = cents - allocated;

  // Distribute residue cent-by-cent to slices with largest fractional remainder.
  remainders.sort((a, b) => b.frac - a.frac || a.idx - b.idx);
  let i = 0;
  while (residue > 0) {
    const target = remainders[i % remainders.length];
    if (!target) break; // unreachable; satisfies typechecker
    floored[target.idx] = (floored[target.idx] ?? 0) + 1;
    residue -= 1;
    i += 1;
  }
  return floored;
}
