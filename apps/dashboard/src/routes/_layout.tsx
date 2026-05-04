// Authenticated dashboard layout: top bar with shop name, sidebar with stub
// nav, content area for nested routes.
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CreditCard,
  Home,
  LogOut,
  Scissors,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { t } from '../strings/pt-BR';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: t.nav.dashboard, icon: Home },
  { to: '/calendar', label: t.nav.calendar, icon: CalendarDays, soon: true },
  { to: '/clients', label: t.nav.clients, icon: Users, soon: true },
  { to: '/services', label: t.nav.services, icon: Scissors, soon: true },
  { to: '/payments', label: t.nav.payments, icon: CreditCard, soon: true },
  { to: '/settings', label: t.nav.settings, icon: Settings, soon: true },
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
  const userInitials =
    shopName
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·';

  return (
    <div className="min-h-screen flex bg-[var(--color-background)]">
      <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] hidden md:flex md:flex-col">
        <div className="px-5 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold text-[var(--color-primary-fg)]"
              style={{ background: 'var(--color-primary)' }}
              aria-hidden
            >
              CP
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">{t.app.name}</div>
              <div className="text-[11px] text-[var(--color-text-muted)] leading-none mt-0.5">
                {t.app.tagline}
              </div>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-[var(--color-surface-muted)] text-[var(--color-text)] font-medium'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                  } ${item.soon ? 'cursor-not-allowed' : ''}`
                }
                onClick={(e) => {
                  if (item.soon) e.preventDefault();
                }}
              >
                <Icon
                  size={16}
                  className={item.soon ? 'opacity-50' : 'opacity-80 group-hover:opacity-100'}
                />
                <span className={`flex-1 ${item.soon ? 'opacity-60' : ''}`}>{item.label}</span>
                {item.soon ? (
                  <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded">
                    em breve
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <LogOut size={16} className="opacity-80" />
            <span>{t.nav.signOut}</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-[var(--color-primary-fg)]"
              style={{ background: 'var(--color-primary)' }}
              aria-hidden
            >
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text)] truncate">
                {meQuery.isLoading ? '...' : shopName}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] leading-none mt-0.5">
                Painel do proprietário
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="md:hidden flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            aria-label={t.nav.signOut}
          >
            <LogOut size={16} />
          </button>
        </header>
        {meQuery.isError ? (
          <div className="m-6 rounded-md border border-[var(--color-danger)] bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
            <strong>Falha ao carregar /v1/me:</strong>{' '}
            {(meQuery.error as Error)?.message ?? 'erro desconhecido'}
          </div>
        ) : null}
        <div className="flex-1 p-6 lg:p-8">
          <Outlet context={{ shopName }} />
        </div>
      </main>
    </div>
  );
}
