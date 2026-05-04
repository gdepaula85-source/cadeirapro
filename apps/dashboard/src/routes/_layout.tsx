// Authenticated dashboard layout: sidebar (md+) or slide-in drawer (mobile),
// top bar with shop name + mobile-only menu toggle, content area for nested
// routes.
import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CreditCard,
  Home,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Users,
  X,
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

interface NavProps {
  onItemClick?: () => void;
  onSignOut: () => void;
}

function NavContent({ onItemClick, onSignOut }: NavProps) {
  return (
    <>
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
              onClick={(e) => {
                if (item.soon) e.preventDefault();
                else onItemClick?.();
              }}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--color-surface-muted)] text-[var(--color-text)] font-medium'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                } ${item.soon ? 'cursor-not-allowed' : ''}`
              }
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
          onClick={onSignOut}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <LogOut size={16} className="opacity-80" />
          <span>{t.nav.signOut}</span>
        </button>
      </div>
    </>
  );
}

export function DashboardLayout() {
  const { session, loading, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

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
      {/* Permanent sidebar (md+) */}
      <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] hidden md:flex md:flex-col">
        <NavContent onSignOut={() => signOut()} />
      </aside>

      {/* Mobile slide-in drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col shadow-lg animate-in slide-in-from-left duration-150">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
            <NavContent
              onItemClick={() => setMobileOpen(false)}
              onSignOut={() => {
                setMobileOpen(false);
                signOut();
              }}
            />
          </aside>
        </div>
      ) : null}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden -ml-1 p-2 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
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
        </header>
        {meQuery.isError ? (
          <div className="m-4 md:m-6 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
            <strong>Falha ao carregar /v1/me:</strong>{' '}
            {(meQuery.error as Error)?.message ?? 'erro desconhecido'}
          </div>
        ) : null}
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet context={{ shopName }} />
        </div>
      </main>
    </div>
  );
}
