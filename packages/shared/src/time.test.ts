import { describe, it, expect } from 'vitest';
import { nowSP, toUtc, formatPtBR, SAO_PAULO_TZ } from './time';

describe('nowSP', () => {
  it('returns a valid Date close to now', () => {
    const before = Date.now();
    const d = nowSP();
    const after = Date.now();
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('toUtc', () => {
  it('SP wall-clock 12:00 = 15:00 UTC (UTC−3, no DST)', () => {
    // Naive date: "2026-05-03 12:00" expressed as UTC components.
    const naive = new Date(Date.UTC(2026, 4, 3, 12, 0, 0));
    const utc = toUtc(naive, SAO_PAULO_TZ);
    expect(utc.toISOString()).toBe('2026-05-03T15:00:00.000Z');
  });

  it('round-trip: format(toUtc(naive, SP)) yields the original wall-clock', () => {
    const naive = new Date(Date.UTC(2026, 9, 15, 9, 30, 0));
    const utc = toUtc(naive, SAO_PAULO_TZ);
    expect(formatPtBR(utc)).toBe('15/10/2026 09:30');
  });

  it('UTC tz is identity', () => {
    const naive = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(toUtc(naive, 'UTC').toISOString()).toBe(naive.toISOString());
  });

  it('rejects invalid Date', () => {
    expect(() => toUtc(new Date(NaN), SAO_PAULO_TZ)).toThrow();
  });
});

describe('formatPtBR', () => {
  it('formats a known UTC instant in SP wall-clock', () => {
    // 2026-05-03T15:00:00Z → SP (UTC−3) → 12:00 on 03/05/2026
    const d = new Date('2026-05-03T15:00:00Z');
    expect(formatPtBR(d)).toBe('03/05/2026 12:00');
  });

  it('handles midnight UTC crossing day boundary in SP', () => {
    // 2026-01-01T02:00:00Z → SP (UTC−3) → 23:00 on 31/12/2025
    const d = new Date('2026-01-01T02:00:00Z');
    expect(formatPtBR(d)).toBe('31/12/2025 23:00');
  });

  it('rejects invalid Date', () => {
    expect(() => formatPtBR(new Date(NaN))).toThrow();
  });
});
