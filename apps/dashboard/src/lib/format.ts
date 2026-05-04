// Display helpers — re-exports from @cadeirapro/shared plus dashboard-only
// formatters. Keeps imports tidy in components.
export { formatBRL, formatPtBR } from '@cadeirapro/shared';

/**
 * Lightly format an E.164 phone for display: +55 (11) 99999-8888.
 * Falls back to the raw input on parse failure — no exceptions thrown.
 */
export function formatPhone(e164: string): string {
  if (!/^\+55\d{10,11}$/.test(e164)) return e164;
  const ddd = e164.slice(3, 5);
  const rest = e164.slice(5);
  if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
