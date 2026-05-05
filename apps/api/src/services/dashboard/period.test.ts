import { describe, it, expect } from 'vitest';
import { shopDayBoundaries, nDaysAgoUtc } from './period';

const SP = 'America/Sao_Paulo';

describe('shopDayBoundaries — São Paulo (UTC-3, no DST since 2019)', () => {
  it('today: midday UTC during the SP day', () => {
    // 2026-05-05 15:00:00 UTC → 12:00 SP, still 2026-05-05 in SP.
    const now = new Date('2026-05-05T15:00:00Z');
    const r = shopDayBoundaries(now, SP, 0);
    expect(r.startUtc).toBe('2026-05-05T03:00:00.000Z'); // 00:00 SP = 03:00 UTC
    expect(r.endUtc).toBe('2026-05-06T03:00:00.000Z');
  });

  it('today: late UTC that is already next day in SP — no, SP is BEHIND UTC', () => {
    // 2026-05-05 02:00 UTC = 2026-05-04 23:00 SP → "today" in SP is May 4.
    const now = new Date('2026-05-05T02:00:00Z');
    const r = shopDayBoundaries(now, SP, 0);
    expect(r.startUtc).toBe('2026-05-04T03:00:00.000Z');
    expect(r.endUtc).toBe('2026-05-05T03:00:00.000Z');
  });

  it('range is exactly 24 hours wide outside DST', () => {
    const now = new Date('2026-05-05T15:00:00Z');
    const r = shopDayBoundaries(now, SP, 0);
    const span = new Date(r.endUtc).getTime() - new Date(r.startUtc).getTime();
    expect(span).toBe(24 * 60 * 60 * 1000);
  });

  it('dayOffset shifts by whole days', () => {
    const now = new Date('2026-05-05T15:00:00Z');
    const yesterday = shopDayBoundaries(now, SP, -1);
    const today = shopDayBoundaries(now, SP, 0);
    expect(yesterday.endUtc).toBe(today.startUtc);
  });

  it('handles month rollover', () => {
    // Last day of the SP month
    const now = new Date('2026-05-31T20:00:00Z'); // 17:00 SP, May 31
    const tomorrow = shopDayBoundaries(now, SP, 1);
    expect(tomorrow.startUtc).toBe('2026-06-01T03:00:00.000Z');
  });
});

describe('shopDayBoundaries — UTC tz (no offset)', () => {
  it('boundaries match calendar UTC midnight', () => {
    const now = new Date('2026-05-05T15:00:00Z');
    const r = shopDayBoundaries(now, 'UTC', 0);
    expect(r.startUtc).toBe('2026-05-05T00:00:00.000Z');
    expect(r.endUtc).toBe('2026-05-06T00:00:00.000Z');
  });
});

describe('nDaysAgoUtc', () => {
  it('30 days ago aligns with the start of that shop-local day', () => {
    const now = new Date('2026-05-05T15:00:00Z');
    const ago = nDaysAgoUtc(now, SP, 30);
    // 30 SP-days before May 5 is April 5.
    expect(ago).toBe('2026-04-05T03:00:00.000Z');
  });

  it('0 days ago = today start', () => {
    const now = new Date('2026-05-05T15:00:00Z');
    expect(nDaysAgoUtc(now, SP, 0)).toBe(shopDayBoundaries(now, SP, 0).startUtc);
  });
});
