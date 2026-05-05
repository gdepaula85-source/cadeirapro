// Period helpers for the home-dashboard KPI route. "Today" is anchored to
// the shop's timezone — a UTC midnight cutoff would be wrong for a São
// Paulo shop opening at 8am local. All inputs are pure; no I/O.
import { toUtc } from '@cadeirapro/shared';

export interface UtcRange {
  /** Inclusive UTC ISO-8601 lower bound. */
  startUtc: string;
  /** Exclusive UTC ISO-8601 upper bound. */
  endUtc: string;
}

/**
 * Compute the UTC bounds of a single shop-local day.
 *
 * `dayOffset` shifts relative to "today in `tz`": 0 = today, -1 = yesterday,
 * 30 = thirty days from now. The returned range is `[start, end)` where
 * `start` is local midnight and `end` is the next local midnight, both
 * converted to UTC.
 */
export function shopDayBoundaries(now: Date, tz: string, dayOffset = 0): UtcRange {
  const ymd = ymdInTz(now, tz);
  const naiveStart = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + dayOffset, 0, 0, 0, 0));
  const naiveEnd = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + dayOffset + 1, 0, 0, 0, 0));
  return {
    startUtc: toUtc(naiveStart, tz).toISOString(),
    endUtc: toUtc(naiveEnd, tz).toISOString(),
  };
}

/**
 * UTC ISO-8601 corresponding to local midnight `days` shop-local-days before
 * today. Use as a `>=` lower bound for "last N days" queries.
 */
export function nDaysAgoUtc(now: Date, tz: string, days: number): string {
  return shopDayBoundaries(now, tz, -days).startUtc;
}

interface YmdParts {
  year: number;
  month: number;
  day: number;
}

function ymdInTz(date: Date, tz: string): YmdParts {
  // 'en-CA' yields ISO-shaped YYYY-MM-DD which is unambiguous to parse.
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [y, m, d] = formatted.split('-').map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}
