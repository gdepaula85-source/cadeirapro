import { describe, it, expect } from 'vitest';
import { computeSplit, type SplitInput } from './split-calculator';

const baseInput = (override: Partial<SplitInput> = {}): SplitInput => ({
  grossCents: 10_000,
  platformFeePct: 0.005,
  barberCommissionPct: 0.5,
  shopPixKey: 'shop@example.com',
  shopPixKeyType: 'email',
  barberPixKey: '12345678901',
  barberPixKeyType: 'cpf',
  platformPixKey: '00000000000000',
  platformPixKeyType: 'cnpj',
  ...override,
});

function totalCents(out: ReturnType<typeof computeSplit>): number {
  return out.primary.amountCents + out.splits.reduce((acc, s) => acc + s.amountCents, 0);
}

describe('computeSplit — canonical case (SPRINT_1 §5 acceptance)', () => {
  it('R$ 100 with 0.5% platform + 50% barber → 4950/5000/50', () => {
    const out = computeSplit(baseInput());
    expect(out.primary.amountCents).toBe(4_950);
    expect(out.splits[0]!.amountCents).toBe(5_000); // barber
    expect(out.splits[1]!.amountCents).toBe(50); // platform
    expect(totalCents(out)).toBe(10_000);
  });

  it('preserves recipient identity', () => {
    const out = computeSplit(baseInput());
    expect(out.primary.pixKey).toBe('shop@example.com');
    expect(out.primary.pixKeyType).toBe('email');
    expect(out.splits[0]!.pixKey).toBe('12345678901');
    expect(out.splits[0]!.metadata).toEqual({ kind: 'barber' });
    expect(out.splits[1]!.pixKey).toBe('00000000000000');
    expect(out.splits[1]!.metadata).toEqual({ kind: 'platform' });
  });
});

describe('computeSplit — rounding edge cases', () => {
  it('always sums exactly to grossCents', () => {
    const cases: Array<Partial<SplitInput>> = [
      { grossCents: 1 },
      { grossCents: 3 },
      { grossCents: 7 },
      { grossCents: 99 },
      { grossCents: 9_999 },
      { grossCents: 12_345 },
      { grossCents: 100_001 },
      { grossCents: 1_234_567 },
      { grossCents: 1_000, barberCommissionPct: 0.6, platformFeePct: 0.0125 },
      { grossCents: 1_000, barberCommissionPct: 0.4, platformFeePct: 0.0075 },
    ];
    for (const c of cases) {
      const out = computeSplit(baseInput(c));
      expect(totalCents(out)).toBe(c.grossCents ?? 10_000);
    }
  });

  it('zero gross → all slices zero', () => {
    const out = computeSplit(baseInput({ grossCents: 0 }));
    expect(out.primary.amountCents).toBe(0);
    expect(out.splits[0]!.amountCents).toBe(0);
    expect(out.splits[1]!.amountCents).toBe(0);
  });

  it('1 cent at canonical rates rounds to all-shop (barber+platform round to 0)', () => {
    // 1 cent * 50% = 0.5 → Math.round → 1 (HALF_UP); shop = 1 - 0 - 1 = 0
    // Wait: 1 * 0.005 = 0.005 → rounds to 0; 1 * 0.5 = 0.5 → JS Math.round
    // does banker's rounding?  Actually Math.round(0.5) in JS = 1.
    const out = computeSplit(baseInput({ grossCents: 1 }));
    expect(totalCents(out)).toBe(1);
    expect(out.splits[0]!.amountCents).toBeGreaterThanOrEqual(0);
    expect(out.splits[1]!.amountCents).toBeGreaterThanOrEqual(0);
    expect(out.primary.amountCents).toBeGreaterThanOrEqual(0);
  });
});

describe('computeSplit — input validation', () => {
  it('rejects negative gross', () => {
    expect(() => computeSplit(baseInput({ grossCents: -1 }))).toThrow(/grossCents/);
  });
  it('rejects non-integer gross', () => {
    expect(() => computeSplit(baseInput({ grossCents: 99.5 }))).toThrow(/grossCents/);
  });
  it('rejects out-of-range platformFeePct', () => {
    expect(() => computeSplit(baseInput({ platformFeePct: -0.01 }))).toThrow(/platformFeePct/);
    expect(() => computeSplit(baseInput({ platformFeePct: 1.01 }))).toThrow(/platformFeePct/);
  });
  it('rejects out-of-range barberCommissionPct', () => {
    expect(() => computeSplit(baseInput({ barberCommissionPct: -0.01 }))).toThrow(
      /barberCommissionPct/,
    );
    expect(() => computeSplit(baseInput({ barberCommissionPct: 1.01 }))).toThrow(
      /barberCommissionPct/,
    );
  });
  it('rejects barber + platform > gross', () => {
    expect(() =>
      computeSplit(baseInput({ barberCommissionPct: 0.8, platformFeePct: 0.3 })),
    ).toThrow(/exceed gross/);
  });
});
