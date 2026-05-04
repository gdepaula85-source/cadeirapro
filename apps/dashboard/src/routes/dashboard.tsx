// Empty dashboard with shop name + four placeholder KPI tiles. SPRINT_1 §10
// demo step 8: top bar shows "Demo Barbearia", four KPI tiles show "—".
import { useOutletContext } from 'react-router-dom';
import { t } from '../strings/pt-BR';

interface LayoutContext {
  shopName: string;
}

const KPI_KEYS = [
  { id: 'bookingsToday' as const, label: t.dashboard.kpis.bookingsToday },
  { id: 'revenueToday' as const, label: t.dashboard.kpis.revenueToday },
  { id: 'noShowRate' as const, label: t.dashboard.kpis.noShowRate },
  { id: 'activeClients' as const, label: t.dashboard.kpis.activeClients },
];

export function DashboardPage() {
  const { shopName } = useOutletContext<LayoutContext>();

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {t.dashboard.greeting}
          {shopName ? `, ${shopName}` : ''}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{t.dashboard.sprintNote}</p>
      </header>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_KEYS.map((k) => (
          <article
            key={k.id}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4"
          >
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              {k.label}
            </div>
            <div className="text-3xl font-semibold mt-2 text-[var(--color-text)]">
              {t.dashboard.placeholder}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
