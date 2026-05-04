import { describe, it, expect } from 'vitest';
import { computeAvailability, type WorkingHoursMap } from './availability';

const SP = 'America/Sao_Paulo';

// 2026-05-04 was a Monday (verified separately). Used as the test date.
const MONDAY = '2026-05-04';

const FULL_DAY: WorkingHoursMap = {
  mon: [{ open: '09:00', close: '18:00' }],
};

const SPLIT_DAY: WorkingHoursMap = {
  mon: [
    { open: '09:00', close: '12:00' },
    { open: '14:00', close: '18:00' },
  ],
};

describe('computeAvailability', () => {
  it('returns no slots when the day has no working hours', () => {
    expect(
      computeAvailability({
        date: MONDAY,
        timezone: SP,
        serviceDurationMinutes: 60,
        workingHours: { tue: [{ open: '09:00', close: '18:00' }] },
        existingBookings: [],
        scheduleBlocks: [],
      }),
    ).toEqual([]);
  });

  it('enumerates 15-min granularity within a single window', () => {
    const slots = computeAvailability({
      date: MONDAY,
      timezone: SP,
      serviceDurationMinutes: 60,
      workingHours: FULL_DAY,
      existingBookings: [],
      scheduleBlocks: [],
    });
    // 9 hours of working time, 60-min service, 15-min granularity.
    // Last slot starts at 17:00 (ends 18:00). 9h × 4 = 36 candidate starts
    // from 09:00..17:45, but only those whose end ≤ 18:00 → 33 slots
    // (09:00..17:00 inclusive in 15-min steps = (17-9)*4 + 1 = 33).
    expect(slots.length).toBe(33);
    expect(slots[0]!.startsAt).toBe('2026-05-04T12:00:00.000Z'); // 09:00 SP = 12:00 UTC
    expect(slots[slots.length - 1]!.startsAt).toBe('2026-05-04T20:00:00.000Z'); // 17:00 SP
  });

  it('respects service duration so the slot stays inside the window', () => {
    // 30-min service with the same 9-hour window: 9h × 4 = 36 starts; last
    // valid start is 17:30 → 35 slots? Let me recount:
    //   from 09:00 to 17:30 inclusive in 15-min steps:
    //   (17.5 - 9) * 4 + 1 = 35
    const slots = computeAvailability({
      date: MONDAY,
      timezone: SP,
      serviceDurationMinutes: 30,
      workingHours: FULL_DAY,
      existingBookings: [],
      scheduleBlocks: [],
    });
    expect(slots.length).toBe(35);
  });

  it('excludes slots that overlap an existing booking', () => {
    // Existing booking 10:00-11:00 SP (= 13:00-14:00 UTC). With a 60-min
    // service and 15-min granularity, candidates 09:15, 09:30, 09:45, 10:00,
    // 10:15, 10:30, 10:45 all overlap; 09:00 is fine (ends at 10:00 — touches
    // but doesn't overlap on a half-open interval).
    const slots = computeAvailability({
      date: MONDAY,
      timezone: SP,
      serviceDurationMinutes: 60,
      workingHours: FULL_DAY,
      existingBookings: [
        { startsAt: '2026-05-04T13:00:00.000Z', endsAt: '2026-05-04T14:00:00.000Z' },
      ],
      scheduleBlocks: [],
    });
    const startsLocal = slots.map((s) => s.startsAt);
    // 09:00 (12:00 UTC) should be present.
    expect(startsLocal).toContain('2026-05-04T12:00:00.000Z');
    // 09:15..10:45 (12:15..13:45 UTC) — overlap zone — should be absent.
    for (const t of [
      '2026-05-04T12:15:00.000Z',
      '2026-05-04T12:30:00.000Z',
      '2026-05-04T12:45:00.000Z',
      '2026-05-04T13:00:00.000Z',
      '2026-05-04T13:15:00.000Z',
      '2026-05-04T13:30:00.000Z',
      '2026-05-04T13:45:00.000Z',
    ]) {
      expect(startsLocal).not.toContain(t);
    }
    // 11:00 (14:00 UTC) should be back in.
    expect(startsLocal).toContain('2026-05-04T14:00:00.000Z');
  });

  it('honours schedule_blocks the same way as bookings', () => {
    const slots = computeAvailability({
      date: MONDAY,
      timezone: SP,
      serviceDurationMinutes: 60,
      workingHours: FULL_DAY,
      existingBookings: [],
      scheduleBlocks: [
        { startsAt: '2026-05-04T16:00:00.000Z', endsAt: '2026-05-04T18:00:00.000Z' },
      ],
    });
    const starts = slots.map((s) => s.startsAt);
    // 13:00 SP = 16:00 UTC. 12:00, 12:30, 12:45 SP overlap the block.
    expect(starts).not.toContain('2026-05-04T15:30:00.000Z');
    expect(starts).not.toContain('2026-05-04T15:45:00.000Z');
    // 12:00 SP (15:00 UTC) ends at 13:00 SP (16:00 UTC) — touches block start
    // but doesn't overlap, so it's allowed.
    expect(starts).toContain('2026-05-04T15:00:00.000Z');
  });

  it('handles split working hours (lunch break)', () => {
    const slots = computeAvailability({
      date: MONDAY,
      timezone: SP,
      serviceDurationMinutes: 60,
      workingHours: SPLIT_DAY,
      existingBookings: [],
      scheduleBlocks: [],
    });
    const starts = slots.map((s) => s.startsAt);
    // 09:00..11:00 SP (12:00..14:00 UTC) — 9 slots in morning window.
    // 14:00..17:00 SP (17:00..20:00 UTC) — 13 slots in afternoon window.
    // No slots starting in 11:15..13:45 SP (lunch break) — would end after
    // 12:00 SP.
    expect(starts).toContain('2026-05-04T12:00:00.000Z'); // 09:00
    expect(starts).toContain('2026-05-04T14:00:00.000Z'); // 11:00 (last morning)
    expect(starts).not.toContain('2026-05-04T14:15:00.000Z'); // 11:15 — would spill into break
    expect(starts).toContain('2026-05-04T17:00:00.000Z'); // 14:00 (first afternoon)
  });

  it('rejects bad inputs', () => {
    const base = {
      date: MONDAY,
      timezone: SP,
      workingHours: FULL_DAY,
      existingBookings: [],
      scheduleBlocks: [],
    };
    expect(() => computeAvailability({ ...base, serviceDurationMinutes: 0 })).toThrow();
    expect(() =>
      computeAvailability({ ...base, serviceDurationMinutes: 60, slotMinutes: 0 }),
    ).toThrow();
    expect(() =>
      computeAvailability({
        ...base,
        serviceDurationMinutes: 60,
        date: '05/04/2026' as unknown as string,
      }),
    ).toThrow();
  });
});
