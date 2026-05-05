// Customer login at /[slug]/login. Uses Supabase auth client-side, same as
// the owner login. Successful sign-in lands on /[slug] (the customer home).
//
// The slug parameter is preserved through the flow purely for navigation
// context â€” auth itself is per-Supabase-user, and the JWT hook injects
// role='customer' for any user linked to a clients row (see migration 0004).
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { PublicThemeApplier } from '../../components/PublicThemeApplier';

export function CustomerLoginPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ['public', 'org', slug],
    queryFn: () => api.public.org(slug),
    enabled: slug.length > 0,
    retry: false,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(`/${slug}`, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/email not confirmed/i.test(msg)) {
        setError('Confirme seu e-mail antes de entrar.');
      } else {
        setError('E-mail ou senha incorretos.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <PublicThemeApplier themeId={orgQuery.data?.themeId ?? null} />
    <main className="min-h-screen bg-[var(--cp-surface-soft)] px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8">
          <Link
            to={`/${slug}/welcome`}
            className="text-xs font-medium uppercase tracking-wider text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]"
          >
            â† Voltar
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--cp-text)]">Entrar</h1>
          <p className="mt-1 text-sm text-[var(--cp-text-muted)]">
            Acesse sua conta para ver agendamentos e pontos.
          </p>
        </header>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="E-mail" icon={Mail}>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="w-full bg-transparent text-sm text-[var(--cp-text)] placeholder-[var(--cp-text-muted)] focus:outline-none"
              placeholder="seu@email.com"
            />
          </Field>
          <Field label="Senha" icon={Lock}>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="w-full bg-transparent text-sm text-[var(--cp-text)] placeholder-[var(--cp-text-muted)] focus:outline-none"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </Field>
          {error ? (
            <p className="text-sm font-medium text-[var(--cp-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="block w-full rounded-2xl bg-[var(--cp-primary)] py-4 text-center text-base font-semibold text-white shadow-[0_14px_30px_rgb(23_101_39_/_0.25)] transition hover:bg-[var(--cp-primary-hover)] disabled:opacity-60 disabled:hover:bg-[var(--cp-primary)]"
          >
            {submitting ? 'Entrandoâ€¦' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--cp-text-muted)]">
          Ainda nÃ£o tem conta?{' '}
          <Link
            to={`/${slug}/signup`}
            className="font-semibold text-[var(--cp-primary)] underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </main>
    </>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--cp-text-muted)]">{label}</span>
      <div className="mt-1.5 flex items-center gap-3 rounded-2xl border border-[var(--cp-border)] bg-white px-4 py-3 transition focus-within:border-[var(--cp-primary)]">
        <Icon size={18} className="shrink-0 text-[var(--cp-text-muted)]" />
        {children}
      </div>
    </label>
  );
}
