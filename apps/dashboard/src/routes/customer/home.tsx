// Customer home at /[slug] â€” auth-gated placeholder. The full design (mock
// screen 2: greeting, featured barbers, categories, search, referral promo,
// bottom nav) lands in subsequent commits as the supporting subsystems
// (reviews, loyalty, referrals, categories taxonomy) come online.
//
// For now this confirms the auth + linking flow worked: a logged-in customer
// sees their name, their shop's name, and a button to book. Anyone hitting
// this without a session is redirected to /[slug]/welcome.
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, LogOut, UserRound } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PublicThemeApplier } from '../../components/PublicThemeApplier';

export function CustomerHomePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { session, loading, signOut } = useAuth();

  const meQuery = useQuery({
    queryKey: ['customer', 'me'],
    queryFn: () => api.customer.me(),
    enabled: !!session,
    retry: false,
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--cp-surface-soft)] text-sm text-[var(--cp-text-muted)]">
        ...
      </main>
    );
  }

  if (!session) return <Navigate to={`/${slug}/welcome`} replace />;

  // The hook injects role='customer' only for users linked to a clients row.
  // If /v1/customer/me 403s with not_a_customer, this session belongs to a
  // shop owner who navigated here by accident â€” punt to their dashboard.
  if (meQuery.error instanceof ApiError && meQuery.error.code === 'not_a_customer') {
    return <Navigate to="/" replace />;
  }

  const me = meQuery.data;
  const themeId = me?.organization.themeId ?? null;

  return (
    <>
    <PublicThemeApplier themeId={themeId} />
    <main className="min-h-screen bg-[var(--cp-surface-soft)] px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cp-text-muted)]">
              {me?.organization.name ?? 'Carregandoâ€¦'}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cp-text)]">
              {me ? `OlÃ¡, ${firstName(me.customer.name)}!` : 'OlÃ¡!'}
            </h1>
            <p className="mt-1 text-sm text-[var(--cp-text-muted)]">Bem-vindo de volta a sua barbearia.</p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-full border border-[var(--cp-border)] bg-white p-2 text-[var(--cp-text-muted)] transition hover:border-[var(--cp-primary)] hover:text-[var(--cp-primary)]"
            aria-label="Sair"
          >
            <LogOut size={16} />
          </button>
        </header>

        <section className="mt-8 rounded-[28px] border border-[var(--cp-border)] bg-white p-6 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cp-primary-tint)] text-[var(--cp-primary)]">
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--cp-text)]">Pronto para agendar?</p>
              <p className="text-xs text-[var(--cp-text-muted)]">Reserve um horÃ¡rio com seu barbeiro.</p>
            </div>
          </div>
          <Link
            to={`/book/${slug}`}
            className="mt-5 block w-full rounded-2xl bg-[var(--cp-primary)] py-3 text-center text-sm font-semibold text-white transition hover:bg-[var(--cp-primary-hover)]"
          >
            Reservar agora
          </Link>
        </section>

        {me?.upcomingBookings[0] ? (
          <section className="mt-6 rounded-[28px] border border-[var(--cp-border)] bg-white p-5 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cp-primary)]">
              Proximo agendamento
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--cp-text)]">
              {me.upcomingBookings[0].serviceName ?? 'Servico'}
            </h2>
            <p className="mt-1 text-sm text-[var(--cp-text-muted)]">
              {formatDateTime(me.upcomingBookings[0].startsAt)}
              {me.upcomingBookings[0].barberName ? ` | ${me.upcomingBookings[0].barberName}` : ''}
            </p>
            <span className="mt-4 inline-flex rounded-full bg-[var(--cp-primary-tint)] px-3 py-1 text-xs font-semibold text-[var(--cp-primary)]">
              {statusLabel(me.upcomingBookings[0].status)}
            </span>
          </section>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-[var(--cp-border)] bg-white p-5 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cp-primary-tint)] text-[var(--cp-primary)]">
              <UserRound size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--cp-text)]">Seu perfil</p>
              <p className="text-xs text-[var(--cp-text-muted)]">Historico, gastos e proximos horarios.</p>
            </div>
          </div>
          <Link
            to={`/${slug}/profile`}
            className="mt-5 block w-full rounded-2xl border border-[var(--cp-border)] bg-white py-3 text-center text-sm font-semibold text-[var(--cp-primary)] transition hover:border-[var(--cp-primary)]"
          >
            Ver meu historico
          </Link>
        </section>
      </div>
    </main>
    </>
  );
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function statusLabel(status: string): string {
  if (status === 'pending') return 'Aguardando confirmacao';
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'completed') return 'Concluido';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'no_show') return 'Nao compareceu';
  return status;
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0]!;
}
