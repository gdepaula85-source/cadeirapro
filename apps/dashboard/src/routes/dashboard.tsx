// Home dashboard: shop name + four live KPI tiles + getting-started callout.
// KPIs come from GET /v1/dashboard/kpis (see apps/api/src/routes/dashboard.ts).
// While loading or on error, tiles fall back to the "—" placeholder so the
// layout stays stable and an empty org reads as "no data yet" not "broken".
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  Scissors,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatBRL, type DashboardKpis } from '@cadeirapro/shared';
import { api } from '../lib/api';
import { t } from '../strings/pt-BR';
import { formatPtBR } from '../lib/format';

interface LayoutContext {
  shopName: string;
}

type KpiId = 'bookingsToday' | 'revenueToday' | 'noShowRate' | 'activeClients';

interface KPIDef {
  id: KpiId;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const KPIS: KPIDef[] = [
  {
    id: 'bookingsToday',
    label: t.dashboard.kpis.bookingsToday,
    icon: CalendarDays,
    hint: 'Total de horários agendados para hoje.',
  },
  {
    id: 'revenueToday',
    label: t.dashboard.kpis.revenueToday,
    icon: TrendingUp,
    hint: 'Soma dos serviços confirmados hoje.',
  },
  {
    id: 'noShowRate',
    label: t.dashboard.kpis.noShowRate,
    icon: AlertCircle,
    hint: 'Clientes que não compareceram nos últimos 30 dias.',
  },
  {
    id: 'activeClients',
    label: t.dashboard.kpis.activeClients,
    icon: Users,
    hint: 'Clientes com agendamento nos últimos 90 dias.',
  },
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
    title: 'Cadastre seus serviços',
    body: 'Defina os cortes oferecidos, duração e preço. Cada serviço alimenta o agendamento.',
    icon: Scissors,
    cta: 'Abrir serviços',
    to: '/services',
  },
  {
    title: 'Adicione sua equipe',
    body: 'Cadastre barbeiros parceiros com a chave Pix de cada um para o split automático.',
    icon: Users,
    cta: 'Abrir equipe',
    to: '/staff',
  },
  {
    title: 'Configure seu horário',
    body: 'Defina os dias e janelas de atendimento. Os clientes só verão os horários disponíveis.',
    icon: CalendarPlus,
    cta: 'Abrir configurações',
    to: '/settings',
  },
  {
    title: 'Conecte o Pix',
    body: 'Receba via QR Code com split em tempo real entre loja, barbeiro e plataforma.',
    icon: CreditCard,
    cta: 'Abrir pagamentos',
    to: '/payments',
  },
];

function formatKpi(id: KpiId, kpis: DashboardKpis | undefined): string {
  if (!kpis) return t.dashboard.placeholder;
  switch (id) {
    case 'bookingsToday':
      return String(kpis.bookingsToday);
    case 'revenueToday':
      return formatBRL(kpis.revenueTodayCents);
    case 'noShowRate':
      return kpis.noShowRate === null
        ? t.dashboard.placeholder
        : `${kpis.noShowRate.toFixed(1)}%`;
    case 'activeClients':
      return String(kpis.activeClients90d);
  }
}

export function DashboardPage() {
  const { shopName } = useOutletContext<LayoutContext>();
  const today = formatPtBR(new Date()).split(' ')[0]; // DD/MM/YYYY

  const kpisQuery = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.dashboard.kpis(),
    // KPIs are read-mostly; one refetch per minute is plenty for the home
    // screen and avoids hammering the Worker on tab focus storms.
    staleTime: 60_000,
  });
  const kpis = kpisQuery.data;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero — greeting + date */}
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
          {today}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight">
          {t.dashboard.greeting}
          {shopName ? `, ${shopName}` : ''}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Serviços, equipe, agenda, pagamentos e configurações já estão conectados para operar a
          barbearia.
        </p>
      </header>

      {/* KPI tiles */}
      <section
        aria-label="Indicadores"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.id}
              className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                  {kpi.label}
                </span>
                <span
                  className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors"
                  style={{ background: 'var(--color-surface-muted)' }}
                  aria-hidden
                >
                  <Icon size={14} />
                </span>
              </div>
              <div className="text-3xl font-semibold text-[var(--color-text)] tabular-nums">
                {formatKpi(kpi.id, kpis)}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 leading-snug">
                {kpi.hint}
              </p>
            </article>
          );
        })}
      </section>

      {/* Next steps */}
      <section aria-label="Próximos passos" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)] tracking-tight">
            Como começar
          </h2>
          <span className="text-xs text-[var(--color-text-muted)]">Sprint 2</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NEXT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.title}
                to={step.to}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 flex gap-4 items-start transition-shadow hover:shadow-sm"
              >
                <div
                  className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-[var(--color-text)]"
                  style={{ background: 'var(--color-surface-muted)' }}
                  aria-hidden
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">{step.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                    {step.body}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    {step.cta}
                    <ArrowRight size={11} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
