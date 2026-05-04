import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, HelpCircle, Mail, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Field } from '../components/Field';
import { Button } from '../components/Button';
import { t } from '../strings/pt-BR';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/email not confirmed/i.test(msg)) setError(t.login.needsConfirmation);
      else setError(t.login.invalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t.login.title}
      footer={
        <>
          {t.login.noAccount}{' '}
          <Link
            to="/signup"
            className="font-medium text-[var(--color-text)] underline hover:no-underline"
          >
            {t.login.createAccount}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label={t.login.email}
          type="email"
          icon={Mail}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <Field
          label={t.login.password}
          type="password"
          icon={Lock}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <div className="flex justify-end -mt-1">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
          >
            <HelpCircle size={14} aria-hidden />
            {t.login.forgotPassword}
          </Link>
        </div>
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t.login.submitting : t.login.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
