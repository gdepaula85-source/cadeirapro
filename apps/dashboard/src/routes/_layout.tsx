// Authenticated dashboard layout: top bar with shop name, sidebar with stub
// nav, content area for nested routes.
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { t } from '../strings/pt-BR';

const NAV_ITEMS: Array<{ to: string; label: string; soon?: boolean }> = [
  { to: '/', label: t.nav.dashboard },
  { to: '/calendar', label: t.nav.calendar, soon: true },
  { to: '/clients', label: t.nav.clients, soon: true },
  { to: '/services', label: t.nav.services, soon: true },
  { to: '/payments', label: t.nav.payments, soon: true },
  { to: '/settings', label: t.nav.settings, soon: true },
];

export function DashboardLayout() {
  const { session, loading, signOut } = useAuth();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
    enabled: !!session,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-text-muted)]">
        ...
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  const shopName = meQuery.data?.organization.name ?? '';

  return (
    <div className="min-h-screen flex bg-[var(--color-background)]">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] py-6 px-3 hidden md:block">
        <div className="px-3 mb-6">
          <div className="text-base font-semibold text-[var(--color-text)]">{t.app.name}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--color-surface-muted)] text-[var(--color-text)] font-medium'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                } ${item.soon ? 'pointer-events-none opacity-60' : ''}`
              }
            >
              <span>{item.label}</span>
              {item.soon ? (
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  em breve
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-[var(--color-text-muted)]">
            {meQuery.isLoading ? '...' : shopName}
          </div>
          <Button variant="ghost" onClick={() => signOut()}>
            {t.nav.signOut}
          </Button>
        </header>
        {meQuery.isError ? (
          <div className="m-6 rounded-md border border-[var(--color-danger)] bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
            <strong>Falha ao carregar /v1/me:</strong>{' '}
            {(meQuery.error as Error)?.message ?? 'erro desconhecido'}
          </div>
        ) : null}
        <div className="p-6">
          <Outlet context={{ shopName }} />
        </div>
      </main>
    </div>
  );
}
