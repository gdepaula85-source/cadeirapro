// Pagamentos / Financials — projected revenue + per-booking three-way split.
//
// Sprint 2 reality check: real Pix transactions land in S3 when Transfeera
// is wired. Until then, this page reads BOOKINGS as the source of truth for
// "what the shop is earning" and computes the three-way split client-side
// from priceCents × org.platformFeePct × barber.commissionPct.
//
// Active rows: status ∈ { confirmed, completed }. Cancelled / no_show are
// excluded from totals (they show in Agenda for cancellation review only).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CreditCard,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { BookingStatus } from '@cadeirapro/shared';
import { api } from '../lib/api';
import { formatBRL } from '../lib/format';
import { t } from '../strings/pt-BR';

const PERIOD_DAYS = 30;
const REVENUE_STATUSES: ReadonlyArray<BookingStatus> = ['confirmed', 'completed'];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekIso(): string {
  return isoDaysAgo(7);
}

function isoNow(): string {
  return new Date().toISOString();
}

function computeBookingSplit(
  priceCents: number,
  platformFeePct: number,
  barberCommissionPct: number,
): { shopCents: number; barberCents: number; platformCents: number } {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return { shopCents: 0, barberCents: 0, platformCents: 0 };
  }
  const platformCents = Math.round(priceCents * platformFeePct);
  const barberCents = Math.round(priceCents * barberCommissionPct);
  const shopCents = Math.max(0, priceCents - platformCents - barberCents);
  return { shopCents, barberCents, platformCents };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-900 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  completed: 'bg-slate-100 text-slate-900 border-slate-300',
  no_show: 'bg-rose-50 text-rose-900 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function PaymentsPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => api.me() });
  const staffQuery = useQuery({ queryKey: ['staff', true], queryFn: () => api.staff.list(true) });

  const bookingsQuery = useQuery({
    queryKey: ['bookings:financials', PERIOD_DAYS],
    queryFn: () => api.bookings.list({ from: isoDaysAgo(PERIOD_DAYS), to: isoNow() }),
  });

  const platformFeePct = meQuery.data?.organization.platformFeePct ?? 0.005;

  const barberCommissionById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of staffQuery.data ?? []) {
      m.set(s.id, typeof s.commissionPct === 'number' ? s.commissionPct : 0.5);
    }
    return m;
  }, [staffQuery.data]);

  const enriched = useMemo(() => {
    const all = bookingsQuery.data ?? [];
    return all.map((b) => {
      const price = typeof b.servicePriceCents === 'number' ? b.servicePriceCents : 0;
      const barberPct = barberCommissionById.get(b.barberId) ?? 0.5;
      const split = computeBookingSplit(price, platformFeePct, barberPct);
      return { booking: b, price, split, barberPct };
    });
  }, [bookingsQuery.data, barberCommissionById, platformFeePct]);

  const totals = useMemo(() => {
    const todayStart = startOfTodayIso();
    const weekStart = startOfWeekIso();

    const include = (status: BookingStatus) => REVENUE_STATUSES.includes(status);

    let todayCents = 0,
      todayCount = 0;
    let weekCents = 0,
      weekCount = 0;
    let periodCents = 0,
      periodCount = 0;
    let pendingCents = 0,
      pendingCount = 0;
    let shopCents = 0,
      barberCents = 0,
      platformCents = 0;

    for (const { booking, price, split } of enriched) {
      if (!include(booking.status as BookingStatus)) continue;
      periodCents += price;
      periodCount += 1;
      shopCents += split.shopCents;
      barberCents += split.barberCents;
      platformCents += split.platformCents;
      if (booking.startsAt >= todayStart) {
        todayCents += price;
        todayCount += 1;
      }
      if (booking.startsAt >= weekStart) {
        weekCents += price;
        weekCount += 1;
      }
      // Confirmed in the future = pending revenue.
      if (booking.status === 'confirmed' && booking.startsAt > new Date().toISOString()) {
        pendingCents += price;
        pendingCount += 1;
      }
    }

    return {
      today: { cents: todayCents, count: todayCount },
      week: { cents: weekCents, count: weekCount },
      period: { cents: periodCents, count: periodCount },
      pending: { cents: pendingCents, count: pendingCount },
      breakdown: { shopCents, barberCents, platformCents },
    };
  }, [enriched]);

  const isError = meQuery.isError || staffQuery.isError || bookingsQuery.isError;
  const isLoading = meQuery.isLoading || staffQuery.isLoading || bookingsQuery.isLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Wallet size={16} />
          <span className="text-xs uppercase tracking-wider font-medium">{t.common.sprint2}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-1">
          {t.payments.title}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
          {t.payments.subtitle}
        </p>
      </header>

      {isError ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{t.payments.errors.generic}</span>
        </div>
      ) : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          icon={CalendarCheck}
          label={t.payments.kpis.today}
          value={isLoading ? '—' : formatBRL(totals.today.cents)}
          hint={`${totals.today.count} ${t.payments.kpis.bookings}`}
        />
        <KPI
          icon={TrendingUp}
          label={t.payments.kpis.week}
          value={isLoading ? '—' : formatBRL(totals.week.cents)}
          hint={`${totals.week.count} ${t.payments.kpis.bookings}`}
        />
        <KPI
          icon={Wallet}
          label={t.payments.kpis.period}
          value={isLoading ? '—' : formatBRL(totals.period.cents)}
          hint={`${totals.period.count} ${t.payments.kpis.bookings}`}
        />
        <KPI
          icon={CalendarClock}
          label={t.payments.kpis.pending}
          value={isLoading ? '—' : formatBRL(totals.pending.cents)}
          hint={`${totals.pending.count} ${t.payments.kpis.bookings}`}
        />
      </section>

      {/* Split breakdown summary for the visible period */}
      {!isLoading && totals.period.count > 0 ? (
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold">{t.payments.splitTitle}</h2>
            <span className="text-xs text-[var(--color-text-muted)]">{t.payments.splitNote}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SplitCard
              label={t.payments.splitParts.shop}
              cents={totals.breakdown.shopCents}
              ofTotal={totals.period.cents}
              tone="emerald"
            />
            <SplitCard
              label={t.payments.splitParts.barber}
              cents={totals.breakdown.barberCents}
              ofTotal={totals.period.cents}
              tone="slate"
            />
            <SplitCard
              label={t.payments.splitParts.platform}
              cents={totals.breakdown.platformCents}
              ofTotal={totals.period.cents}
              tone="amber"
            />
          </div>
        </section>
      ) : null}

      {/* Booking ledger */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium flex items-center justify-between">
          <span>
            {isLoading ? t.common.loading : `${enriched.length} ${t.payments.recentBookings}`}
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)]">{t.payments.last30}</span>
        </div>
        {!isLoading && enriched.length === 0 ? (
          <div className="p-8 text-sm text-[var(--color-text-muted)]">{t.common.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-muted)]/40">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.payments.cols.when}</th>
                  <th className="px-4 py-2 font-medium">{t.payments.cols.client}</th>
                  <th className="px-4 py-2 font-medium">{t.payments.cols.barber}</th>
                  <th className="px-4 py-2 font-medium">{t.payments.cols.service}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.payments.cols.total}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.payments.cols.shop}</th>
                  <th className="px-4 py-2 font-medium text-right">
                    {t.payments.cols.barberShare}
                  </th>
                  <th className="px-4 py-2 font-medium text-right">{t.payments.cols.platform}</th>
                  <th className="px-4 py-2 font-medium">{t.payments.cols.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {enriched.map(({ booking, price, split }) => (
                  <tr key={booking.id}>
                    <td className="px-4 py-2 text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                      {formatDateTime(booking.startsAt)}
                    </td>
                    <td className="px-4 py-2">{booking.clientName ?? '—'}</td>
                    <td className="px-4 py-2 text-[var(--color-text-muted)]">
                      {booking.barberName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-muted)]">
                      {booking.serviceName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatBRL(price)}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--color-text-muted)] tabular-nums">
                      {formatBRL(split.shopCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--color-text-muted)] tabular-nums">
                      {formatBRL(split.barberCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--color-text-muted)] tabular-nums">
                      {formatBRL(split.platformCents)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${STATUS_BADGE[booking.status as BookingStatus]}`}
                      >
                        {t.calendar.status[booking.status as BookingStatus] ?? booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4 text-sm text-[var(--color-text-muted)] flex items-start gap-2">
        <CreditCard size={16} className="shrink-0 mt-0.5" />
        <span>{t.payments.s3Note}</span>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)]">
          {label}
        </span>
        <span
          className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)]"
          style={{ background: 'var(--color-surface-muted)' }}
          aria-hidden
        >
          <Icon size={14} />
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">{value}</div>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{hint}</p>
    </article>
  );
}

function SplitCard({
  label,
  cents,
  ofTotal,
  tone,
}: {
  label: string;
  cents: number;
  ofTotal: number;
  tone: 'emerald' | 'slate' | 'amber';
}) {
  const pct = ofTotal > 0 ? Math.round((cents / ofTotal) * 100) : 0;
  const ringClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-slate-200 bg-slate-50/60';
  return (
    <div className={`rounded-md border px-4 py-3 ${ringClass}`}>
      <div className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1">{formatBRL(cents)}</div>
      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{pct}%</div>
    </div>
  );
}
