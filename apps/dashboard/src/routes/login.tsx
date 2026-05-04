import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
          <Link to="/signup" className="text-[var(--color-text)] underline">
            {t.login.createAccount}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label={t.login.email}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <Field
          label={t.login.password}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t.login.submitting : t.login.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
