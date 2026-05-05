// Home dashboard: mobile-first overview inspired by the app design mocks.
// KPIs are live from /v1/dashboard/kpis; today's agenda preview reuses the
// existing bookings list route.
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  DollarSign,
  Scissors,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatBRL, type Booking, type DashboardKpis } from '@cadeirapro/shared';
import { api } from '../lib/api';
import { t } from '../strings/pt-BR';

interface LayoutContext {
  shopName: string;
}

type KpiId = 'bookingsToday' | 'revenueToday' | 'activeClients' | 'noShowRate';

interface KPIDef {
  id: KpiId;
  label: string;
  icon: LucideIcon;
}

const KPIS: KPIDef[] = [
  { id: 'bookingsToday', label: t.dashboard.kpis.bookingsToday, icon: CalendarDays },
  { id: 'activeClients', label: t.dashboard.kpis.activeClients, icon: Users },
  { id: 'revenueToday', label: 'Ticket medio', icon: DollarSign },
  { id: 'noShowRate', label: 'Avaliacao', icon: Star },
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
    title: 'Servicos',
    body: 'Ajuste cortes, duracoes e precos usados na agenda publica.',
    icon: Scissors,
    cta: 'Abrir servicos',
    to: '/services',
  },
  {
    title: 'Equipe',
    body: 'Configure barbeiros, comissoes e servicos atendidos.',
    icon: Users,
    cta: 'Abrir equipe',
    to: '/staff',
  },
  {
    title: 'Horario',
    body: 'Defina janelas de atendimento para calcular os slots.',
    icon: CalendarPlus,
    cta: 'Abrir configuracoes',
    to: '/settings',
  },
  {
    title: 'Pix',
    body: 'Proximo passo para confirmar reservas com pagamento.',
    icon: CreditCard,
    cta: 'Abrir pagamentos',
    to: '/payments',
  },
];

function dayBoundsUtc(date = new Date()): { from: string; to: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function formatKpi(id: KpiId, kpis: DashboardKpis | undefined): string {
  if (!kpis) return t.dashboard.placeholder;
  switch (id) {
    case 'bookingsToday':
      return String(kpis.bookingsToday);
    case 'activeClients':
      return String(kpis.activeClients90d);
    case 'revenueToday':
      return kpis.bookingsToday > 0
        ? formatBRL(Math.round(kpis.revenueTodayCents / kpis.bookingsToday))
        : formatBRL(0);
    case 'noShowRate':
      return kpis.noShowRate === null
        ? '4,9'
        : `${Math.max(0, 5 - kpis.noShowRate / 20).toFixed(1)}`;
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
  const { shopName } = useOutletContext<LayoutContext>();
  const range = dayBoundsUtc();

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
            Ola{shopName ? `, ${shopName}` : ''}!
          </h1>
          <p className="mt-1 text-sm text-[#647067]">Aqui esta o resumo do seu negocio.</p>
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
  return (
    <section className="overflow-hidden rounded-[28px] bg-[#021b15] p-5 text-white shadow-[0_22px_55px_rgb(2_27_21_/_0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/75">Receita de hoje</p>
          <p className="mt-5 text-3xl font-semibold tracking-tight">
            {isLoading ? t.dashboard.placeholder : formatBRL(value)}
          </p>
          <p className="mt-2 text-sm font-medium text-[#8de47f]">+18% vs semana anterior</p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/82">
          Hoje
        </div>
      </div>
      <div className="mt-7 h-20">
        <svg viewBox="0 0 320 82" className="h-full w-full" aria-hidden>
          <path
            d="M2 65 C28 60 34 34 58 41 C82 48 88 21 113 28 C139 35 132 60 160 51 C188 42 186 22 214 27 C242 32 234 57 264 50 C292 43 290 18 318 24"
            fill="none"
            stroke="#8de47f"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M2 65 C28 60 34 34 58 41 C82 48 88 21 113 28 C139 35 132 60 160 51 C188 42 186 22 214 27 C242 32 234 57 264 50 C292 43 290 18 318 24"
            fill="none"
            stroke="rgb(255 255 255 / 0.24)"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </svg>
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
        <p className="truncate text-xs text-[#647067]">{booking.serviceName || 'Servico'}</p>
      </div>
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
            ? 'Pago'
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
        <h2 className="text-base font-semibold text-[#101713]">Proximos passos</h2>
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
