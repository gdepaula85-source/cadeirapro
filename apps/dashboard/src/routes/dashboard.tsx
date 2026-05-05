// Home dashboard: mobile-first overview inspired by the app design mocks.
// KPIs are live from /v1/dashboard/kpis; today's agenda preview reuses the
// existing bookings list route.
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  DollarSign,
  Scissors,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatBRL, SAO_PAULO_TZ, type Booking, type DashboardKpis } from '@cadeirapro/shared';
import { api } from '../lib/api';
import { t } from '../strings/pt-BR';

interface LayoutContext {
  shopName: string;
  /** IANA tz from /v1/me; defaults to São Paulo when the org row has none. */
  timezone: string;
}

type KpiId = 'bookingsToday' | 'revenueToday' | 'activeClients' | 'noShowRate';

interface KPIDef {
  id: KpiId;
  label: string;
  icon: LucideIcon;
}

// Labels match pt-BR.ts so a fresh translator only edits one file. The mock
// shows "Ticket médio" and "Avaliação", but neither is real data yet (no
// reviews table; ticket-medio needs a 30/90-day window not today). Reverting
// to the honest metrics we actually compute and swap labels when the backing
// data lands.
const KPIS: KPIDef[] = [
  { id: 'bookingsToday', label: t.dashboard.kpis.bookingsToday, icon: CalendarDays },
  { id: 'activeClients', label: t.dashboard.kpis.activeClients, icon: Users },
  { id: 'revenueToday', label: t.dashboard.kpis.revenueToday, icon: DollarSign },
  { id: 'noShowRate', label: t.dashboard.kpis.noShowRate, icon: AlertCircle },
];

interface NextStep {
  title: string;
  body: string;
  icon: LucideIcon;
  cta: string;
  to: string;
}

const NEXT_STEPS: NextStep[] = [
  {
    title: 'Serviços',
    body: 'Ajuste cortes, durações e preços usados na agenda pública.',
    icon: Scissors,
    cta: 'Abrir serviços',
    to: '/services',
  },
  {
    title: 'Equipe',
    body: 'Configure barbeiros, comissões e serviços atendidos.',
    icon: Users,
    cta: 'Abrir equipe',
    to: '/staff',
  },
  {
    title: 'Horário',
    body: 'Defina janelas de atendimento para calcular os slots.',
    icon: CalendarPlus,
    cta: 'Abrir configurações',
    to: '/settings',
  },
  {
    title: 'Pix',
    body: 'Próximo passo para confirmar reservas com pagamento.',
    icon: CreditCard,
    cta: 'Abrir pagamentos',
    to: '/payments',
  },
];

/**
 * UTC bounds of "today" anchored to the shop's timezone. Browser-local
 * boundaries would be wrong for an owner traveling out of the shop's tz —
 * the KPI route already computes today this way (see apps/api/src/services
 * /dashboard/period.ts), so the agenda list and the "Agendamentos hoje" tile
 * stay in agreement.
 */
function dayBoundsUtc(tz: string, now = new Date()): { from: string; to: string } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  // Build local-midnight in the shop tz by reinterpreting a naive UTC date.
  // (Same trick as the API — kept inline rather than dragging shopDayBoundaries
  // out of services/dashboard since that helper isn't exported from shared.)
  const naiveStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const naiveEnd = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  const wall = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
  const offsetMs = (naive: Date) => {
    const parts = wall(naive);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const wallMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return wallMs - naive.getTime();
  };
  const startMs = naiveStart.getTime() - offsetMs(naiveStart);
  const endMs = naiveEnd.getTime() - offsetMs(naiveEnd);
  return { from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString() };
}

function formatKpi(id: KpiId, kpis: DashboardKpis | undefined): string {
  if (!kpis) return t.dashboard.placeholder;
  switch (id) {
    case 'bookingsToday':
      return String(kpis.bookingsToday);
    case 'activeClients':
      return String(kpis.activeClients90d);
    case 'revenueToday':
      return formatBRL(kpis.revenueTodayCents);
    case 'noShowRate':
      // Null = zero denominator (no completed/no-show bookings in 30d). Show
      // the placeholder rather than fabricating a number.
      return kpis.noShowRate === null
        ? t.dashboard.placeholder
        : `${kpis.noShowRate.toFixed(1)}%`;
  }
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatToday(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());
}

export function DashboardPage() {
  const { shopName, timezone } = useOutletContext<LayoutContext>();
  const range = dayBoundsUtc(timezone || SAO_PAULO_TZ);

  const kpisQuery = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.dashboard.kpis(),
    staleTime: 60_000,
  });

  const bookingsQuery = useQuery({
    queryKey: ['dashboard', 'bookings-today'],
    queryFn: () => api.bookings.list({ from: range.from, to: range.to }),
    staleTime: 60_000,
  });

  const kpis = kpisQuery.data;
  const bookings = (bookingsQuery.data ?? []).filter((booking) => booking.status !== 'cancelled');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium capitalize text-[#647067]">{formatToday()}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#101713]">
            Olá{shopName ? `, ${shopName}` : ''}!
          </h1>
          <p className="mt-1 text-sm text-[#647067]">Aqui está o resumo do seu negócio.</p>
        </div>
        <Link
          to="/calendar"
          className="hidden rounded-full border border-[#dfe7dc] bg-white px-4 py-2 text-sm font-semibold text-[#176527] shadow-sm transition hover:border-[#a8d5a1] sm:inline-flex"
        >
          Ver agenda
        </Link>
      </header>

      <RevenueHero value={kpis?.revenueTodayCents ?? 0} isLoading={kpisQuery.isLoading} />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} value={formatKpi(kpi.id, kpis)} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <AgendaPreview bookings={bookings} isLoading={bookingsQuery.isLoading} />
        <NextSteps />
      </section>
    </div>
  );
}

function RevenueHero({ value, isLoading }: { value: number; isLoading: boolean }) {
  // The mock includes a "+18% vs semana anterior" badge and a sparkline. Both
  // are placeholders for real period-over-period and time-series data — when
  // those land, restore the badge driven by a real WoW % and the sparkline
  // driven by the last 7 days of revenue. Until then we don't ship either,
  // because hardcoded figures look real enough to mislead.
  return (
    <section className="overflow-hidden rounded-[28px] bg-[#021b15] p-5 text-white shadow-[0_22px_55px_rgb(2_27_21_/_0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/75">Receita de hoje</p>
          <p className="mt-5 text-3xl font-semibold tracking-tight">
            {isLoading ? t.dashboard.placeholder : formatBRL(value)}
          </p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/82">
          Hoje
        </div>
      </div>
    </section>
  );
}

function KpiCard({ kpi, value }: { kpi: KPIDef; value: string }) {
  const Icon = kpi.icon;
  return (
    <article className="rounded-[22px] border border-[#dfe7dc] bg-white p-4 shadow-[0_12px_30px_rgb(25_38_28_/_0.06)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#edf7e9] text-[#176527]">
        <Icon size={17} />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-[#101713] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs leading-4 text-[#647067]">{kpi.label}</p>
    </article>
  );
}

function AgendaPreview({ bookings, isLoading }: { bookings: Booking[]; isLoading: boolean }) {
  return (
    <section className="rounded-[28px] border border-[#dfe7dc] bg-white p-5 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#101713]">Agenda de hoje</h2>
        <Link to="/calendar" className="text-sm font-medium text-[#647067] hover:text-[#176527]">
          Ver agenda
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <AgendaSkeleton />
        ) : bookings.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[#dfe7dc] bg-[#fbfdf9] px-4 py-6 text-sm text-[#647067]">
            Nenhum atendimento para hoje.
          </div>
        ) : (
          bookings
            .slice(0, 5)
            .map((booking, index) => (
              <AgendaItem
                key={booking.id}
                booking={booking}
                accent={AGENDA_ACCENTS[index % AGENDA_ACCENTS.length]!}
              />
            ))
        )}
      </div>
    </section>
  );
}

const AGENDA_ACCENTS = ['#176527', '#f28c38', '#55b9c8', '#8e6be8'];

function AgendaItem({ booking, accent }: { booking: Booking; accent: string }) {
  return (
    <article className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] border border-[#e4ebe1] bg-white px-3 py-3">
      <div
        className="border-l-4 pl-3 text-sm font-semibold text-[#101713]"
        style={{ borderColor: accent }}
      >
        {formatTime(booking.startsAt)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#101713]">
          {booking.clientName || 'Cliente'}
        </p>
        <p className="truncate text-xs text-[#647067]">{booking.serviceName || 'Serviço'}</p>
      </div>
      {/*
        Status badge is purely the booking lifecycle, NOT payment. When Pix
        ships and `payments.status` exists, drive a separate "Pago/Não pago"
        chip from there — but `completed` will sometimes coincide with a
        failed payment, so the two must stay distinct.
      */}
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
          booking.status === 'pending'
            ? 'bg-amber-50 text-amber-800'
            : booking.status === 'completed'
              ? 'bg-slate-100 text-slate-700'
              : 'bg-[#e7f5e1] text-[#176527]'
        }`}
      >
        {booking.status === 'pending'
          ? 'Pendente'
          : booking.status === 'completed'
            ? 'Concluído'
            : 'Confirmado'}
      </span>
    </article>
  );
}

function AgendaSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[66px] animate-pulse rounded-[20px] border border-[#e4ebe1] bg-[#f6f8f5]"
        />
      ))}
    </>
  );
}

function NextSteps() {
  return (
    <section className="rounded-[28px] border border-[#dfe7dc] bg-white p-5 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#101713]">Próximos passos</h2>
        <TrendingUp size={18} className="text-[#176527]" />
      </div>
      <div className="mt-4 grid gap-3">
        {NEXT_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.title}
              to={step.to}
              className="group flex items-center gap-3 rounded-[20px] border border-[#e4ebe1] bg-[#fbfdf9] p-3 transition hover:border-[#a8d5a1] hover:bg-white"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#edf7e9] text-[#176527]">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#101713]">{step.title}</p>
                <p className="truncate text-xs text-[#647067]">{step.body}</p>
              </div>
              <ArrowRight
                size={16}
                className="text-[#98a59b] transition group-hover:text-[#176527]"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
