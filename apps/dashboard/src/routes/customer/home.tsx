// Customer home at /[slug] — auth-gated placeholder. The full design (mock
// screen 2: greeting, featured barbers, categories, search, referral promo,
// bottom nav) lands in subsequent commits as the supporting subsystems
// (reviews, loyalty, referrals, categories taxonomy) come online.
//
// For now this confirms the auth + linking flow worked: a logged-in customer
// sees their name, their shop's name, and a button to book. Anyone hitting
// this without a session is redirected to /[slug]/welcome.
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, LogOut } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

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
      <main className="flex min-h-screen items-center justify-center bg-[#fbfdf9] text-sm text-[#647067]">
        ...
      </main>
    );
  }

  if (!session) return <Navigate to={`/${slug}/welcome`} replace />;

  // The hook injects role='customer' only for users linked to a clients row.
  // If /v1/customer/me 403s with not_a_customer, this session belongs to a
  // shop owner who navigated here by accident — punt to their dashboard.
  if (meQuery.error instanceof ApiError && meQuery.error.code === 'not_a_customer') {
    return <Navigate to="/" replace />;
  }

  const me = meQuery.data;

  return (
    <main className="min-h-screen bg-[#fbfdf9] px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#647067]">
              {me?.organization.name ?? 'Carregando…'}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#101713]">
              {me ? `Olá, ${firstName(me.customer.name)}!` : 'Olá!'}
            </h1>
            <p className="mt-1 text-sm text-[#647067]">Bem-vindo de volta à sua barbearia.</p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-full border border-[#dfe7dc] bg-white p-2 text-[#647067] transition hover:border-[#176527] hover:text-[#176527]"
            aria-label="Sair"
          >
            <LogOut size={16} />
          </button>
        </header>

        <section className="mt-8 rounded-[28px] border border-[#dfe7dc] bg-white p-6 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf7e9] text-[#176527]">
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#101713]">Pronto para agendar?</p>
              <p className="text-xs text-[#647067]">Reserve um horário com seu barbeiro.</p>
            </div>
          </div>
          <Link
            to={`/book/${slug}`}
            className="mt-5 block w-full rounded-2xl bg-[#176527] py-3 text-center text-sm font-semibold text-white transition hover:bg-[#125020]"
          >
            Reservar agora
          </Link>
        </section>

        {/* Placeholders for the full home design — featured barbers, categories,
            agenda, loyalty card, referral promo. Each is its own follow-up
            commit gated on schema + API support. */}
        <section className="mt-6 rounded-[28px] border border-dashed border-[#dfe7dc] bg-white/60 p-5 text-center">
          <p className="text-sm font-medium text-[#647067]">
            Mais funcionalidades chegando em breve
          </p>
          <p className="mt-1 text-xs text-[#98a59b]">
            Histórico, programa de fidelidade, indicações e avaliações.
          </p>
        </section>
      </div>
    </main>
  );
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0]!;
}
