// Time helpers. JS Date is a UTC instant; timezone is presentation-only.
// Build Guide §1.2: "All times use the America/Sao_Paulo timezone for
// shop-facing display; UTC in storage."

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

/**
 * Current instant. Identical to `new Date()` — naming exists to express
 * intent at call sites that conceptually mean "current shop time".
 * Format with `formatPtBR` for display.
 */
export function nowSP(): Date {
  return new Date();
}

interface WallClockParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClockInTz(date: Date, tz: string): WallClockParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const out: Partial<WallClockParts> = {};
  for (const p of parts) {
    if (p.type === 'literal') continue;
    const v = parseInt(p.value, 10);
    switch (p.type) {
      case 'year':
        out.year = v;
        break;
      case 'month':
        out.month = v;
        break;
      case 'day':
        out.day = v;
        break;
      case 'hour':
        out.hour = v;
        break;
      case 'minute':
        out.minute = v;
        break;
      case 'second':
        out.second = v;
        break;
    }
  }
  return out as WallClockParts;
}

/**
 * Reinterpret the UTC wall-clock components of `naiveDate` as belonging to
 * `tz`, and return the corresponding UTC instant.
 *
 * Use case: a form input "2026-05-03 18:00" that the shop owner enters
 * meaning "in São Paulo time". We construct it as a UTC Date for transport,
 * then call `toUtc(d, 'America/Sao_Paulo')` to get the real UTC instant
 * (which is 21:00 UTC because SP is UTC−3).
 *
 * Handles DST correctly via Intl.DateTimeFormat. Brazil has had no DST
 * since 2019, but other tz inputs may still observe it.
 */
export function toUtc(naiveDate: Date, tz: string): Date {
  if (!(naiveDate instanceof Date) || Number.isNaN(naiveDate.getTime())) {
    throw new RangeError('toUtc: invalid Date');
  }
  // First guess: the components ARE the UTC instant.
  const guessedMs = Date.UTC(
    naiveDate.getUTCFullYear(),
    naiveDate.getUTCMonth(),
    naiveDate.getUTCDate(),
    naiveDate.getUTCHours(),
    naiveDate.getUTCMinutes(),
    naiveDate.getUTCSeconds(),
    naiveDate.getUTCMilliseconds(),
  );
  // What wall-clock does that produce in tz?
  const wc = wallClockInTz(new Date(guessedMs), tz);
  const wcMs = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  const offsetMs = wcMs - guessedMs;
  return new Date(guessedMs - offsetMs);
}

const PT_BR_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Format a Date in pt-BR locale, anchored to America/Sao_Paulo.
 * Output shape: "DD/MM/YYYY HH:mm".
 */
export function formatPtBR(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError('formatPtBR: invalid Date');
  }
  const parts = PT_BR_FORMATTER.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  return `${m.day}/${m.month}/${m.year} ${m.hour}:${m.minute}`;
}
