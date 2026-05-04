import { describe, it, expect } from 'vitest';
import { toCents, formatBRL, splitProportional } from './money';

describe('toCents', () => {
  it('handles plain numbers', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(1)).toBe(100);
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.05)).toBe(5);
  });

  it('handles pt-BR formatted strings', () => {
    expect(toCents('12,34')).toBe(1234);
    expect(toCents('1.234,56')).toBe(123456);
    expect(toCents('R$ 1.234,56')).toBe(123456);
    expect(toCents('R$12,34')).toBe(1234);
  });

  it('handles plain dot-decimal strings', () => {
    expect(toCents('12.34')).toBe(1234);
    expect(toCents('0.05')).toBe(5);
  });

  it('rejects more than 2 decimal places', () => {
    expect(() => toCents(12.345)).toThrow();
    expect(() => toCents('12,345')).toThrow();
  });

  it('rejects non-finite and empty', () => {
    expect(() => toCents(NaN)).toThrow();
    expect(() => toCents(Infinity)).toThrow();
    expect(() => toCents('')).toThrow();
    expect(() => toCents('abc')).toThrow();
  });
});

describe('formatBRL', () => {
  it('formats common cases', () => {
    // Note: pt-BR uses U+00A0 (non-breaking space) between R$ and the number.
    expect(formatBRL(0)).toMatch(/^R\$\s0,00$/);
    expect(formatBRL(100)).toMatch(/^R\$\s1,00$/);
    expect(formatBRL(123456)).toMatch(/^R\$\s1\.234,56$/);
    expect(formatBRL(5)).toMatch(/^R\$\s0,05$/);
  });

  it('rejects non-integer cents', () => {
    expect(() => formatBRL(12.34)).toThrow();
  });
});

describe('splitProportional', () => {
  it('returns the canonical 50/49.5/0.5 split for R$ 100', () => {
    // R$ 100 = 10_000 cents → barber 50%, shop 49.5%, platform 0.5%
    const out = splitProportional(10_000, [0.5, 0.495, 0.005]);
    expect(out).toEqual([5_000, 4_950, 50]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it('always sums to the input', () => {
    const cases: [number, number[]][] = [
      [9_999, [0.5, 0.495, 0.005]],
      [1, [0.5, 0.5]],
      [3, [1, 1, 1]],
      [7, [0.3, 0.3, 0.4]],
      [12_345, [0.2, 0.3, 0.5]],
      [0, [0.5, 0.5]],
    ];
    for (const [cents, ratios] of cases) {
      const out = splitProportional(cents, ratios);
      expect(out.reduce((a, b) => a + b, 0)).toBe(cents);
      expect(out.length).toBe(ratios.length);
      for (const x of out) expect(x).toBeGreaterThanOrEqual(0);
    }
  });

  it('distributes residue to largest fractional remainder', () => {
    // 10 cents split [1/3, 1/3, 1/3] → 3.33, 3.33, 3.34 → all frac 0.33;
    // residue = 1 → goes to first index by stable tiebreak.
    expect(splitProportional(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });

  it('rejects bad inputs', () => {
    expect(() => splitProportional(-1, [1])).toThrow();
    expect(() => splitProportional(100, [])).toThrow();
    expect(() => splitProportional(100, [0, 0])).toThrow();
    expect(() => splitProportional(100, [-1, 1])).toThrow();
    expect(() => splitProportional(1.5, [1])).toThrow();
  });
});
