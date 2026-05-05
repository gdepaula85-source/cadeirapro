import { describe, expect, it } from 'vitest';
import {
  CreateScheduleBlockInputSchema,
  ScheduleBlockListQuerySchema,
  UpdateScheduleBlockInputSchema,
} from './index';

describe('CreateScheduleBlockInputSchema', () => {
  it('accepts shop-wide blocks', () => {
    const parsed = CreateScheduleBlockInputSchema.parse({
      barberId: null,
      startsAt: '2026-05-05T12:00:00.000Z',
      endsAt: '2026-05-05T13:00:00.000Z',
      reason: 'Almoço',
    });
    expect(parsed.barberId).toBeNull();
    expect(parsed.reason).toBe('Almoço');
  });

  it('rejects inverted ranges', () => {
    expect(() =>
      CreateScheduleBlockInputSchema.parse({
        startsAt: '2026-05-05T13:00:00.000Z',
        endsAt: '2026-05-05T12:00:00.000Z',
      }),
    ).toThrow(/endsAt/);
  });
});

describe('UpdateScheduleBlockInputSchema', () => {
  it('rejects empty patches', () => {
    expect(() => UpdateScheduleBlockInputSchema.parse({})).toThrow(/at least one field/);
  });

  it('allows reason-only patches', () => {
    expect(UpdateScheduleBlockInputSchema.parse({ reason: '' })).toEqual({ reason: null });
  });
});

describe('ScheduleBlockListQuerySchema', () => {
  it('requires an ISO range', () => {
    const parsed = ScheduleBlockListQuerySchema.parse({
      from: '2026-05-05T00:00:00.000Z',
      to: '2026-05-06T00:00:00.000Z',
    });
    expect(parsed.from).toContain('2026-05-05');
  });
});
