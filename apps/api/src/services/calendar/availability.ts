// Pure availability computation. Given a date, working hours, service
// duration, and existing bookings + schedule blocks, yields the list of
// time slots a new booking can occupy. No I/O — easy to unit test.
//
// The function works in **shop wall-clock** to enumerate slots, then
// converts each slot to UTC for return / comparison with the existing
// (UTC-stored) bookings.
import { toUtc } from '@cadeirapro/shared';

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface WorkingWindow {
  open: string; // 'HH:MM' in shop tz
  close: string; // 'HH:MM' in shop tz
}

export type WorkingHoursMap = Partial<Record<DayKey, WorkingWindow[]>>;

export interface TimeRange {
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
}

export interface AvailabilityInput {
  date: string; // YYYY-MM-DD in shop tz
  timezone: string; // e.g. 'America/Sao_Paulo'
  serviceDurationMinutes: number;
  /** Slot granularity in minutes (default 15). */
  slotMinutes?: number;
  workingHours: WorkingHoursMap;
  /** Existing bookings for the relevant barber, ISO UTC. */
  existingBookings: TimeRange[];
  /** Schedule blocks that apply (barber-specific OR shop-wide). */
  scheduleBlocks: TimeRange[];
}

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function dayKeyFor(dateYmd: string): DayKey {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (!m) throw new Error(`invalid date: ${dateYmd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Noon UTC dodges DST shifts; weekday is determined by the calendar date.
  const idx = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
  return DAY_KEYS[idx]!;
}

function parseHHMM(value: string): { hours: number; minutes: number } {
  const m = HHMM_RE.exec(value);
  if (!m) throw new Error(`invalid time: ${value}`);
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

/** Build a UTC instant from "YYYY-MM-DD" + "HH:MM" wall-clock in `tz`. */
function wallClockToUtc(dateYmd: string, hhmm: string, tz: string): Date {
  const [y, mo, d] = dateYmd.split('-').map(Number) as [number, number, number];
  const { hours, minutes } = parseHHMM(hhmm);
  // Construct a "naive" UTC date that holds the same wall-clock components,
  // then reinterpret in tz.
  const naive = new Date(Date.UTC(y, mo - 1, d, hours, minutes, 0, 0));
  return toUtc(naive, tz);
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Enumerate available slots for the given inputs. Output is sorted by
 * startsAt and each slot has length === serviceDurationMinutes (in UTC).
 */
export function computeAvailability(input: AvailabilityInput): TimeRange[] {
  const slotMinutes = input.slotMinutes ?? 15;
  if (input.serviceDurationMinutes <= 0) {
    throw new Error('serviceDurationMinutes must be positive');
  }
  if (slotMinutes <= 0) {
    throw new Error('slotMinutes must be positive');
  }

  const dayKey = dayKeyFor(input.date);
  const windows = input.workingHours[dayKey] ?? [];
  if (windows.length === 0) return [];

  const out: TimeRange[] = [];

  for (const win of windows) {
    const winOpen = wallClockToUtc(input.date, win.open, input.timezone);
    const winClose = wallClockToUtc(input.date, win.close, input.timezone);
    if (winClose <= winOpen) continue; // ignore inverted/empty window

    let cursor = winOpen.getTime();
    const limit = winClose.getTime() - input.serviceDurationMinutes * 60_000;
    const slotMs = slotMinutes * 60_000;
    const serviceMs = input.serviceDurationMinutes * 60_000;

    while (cursor <= limit) {
      const start = new Date(cursor);
      const end = new Date(cursor + serviceMs);
      const candidate: TimeRange = {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      };
      const conflicting =
        input.existingBookings.some((b) => overlaps(candidate, b)) ||
        input.scheduleBlocks.some((b) => overlaps(candidate, b));
      if (!conflicting) out.push(candidate);
      cursor += slotMs;
    }
  }

  return out;
}
