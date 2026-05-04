// Callback page for the Supabase password-recovery email link.
//
// Supabase puts an access token in the URL fragment when the user clicks
// the recovery link; the supabase-js client (configured with
// detectSessionInUrl: true) picks it up and emits a 'PASSWORD_RECOVERY'
// auth event. While the recovery session is active the user can call
// supabase.auth.updateUser({ password }) without their old password.
//
// We allow the page to render whether the link is fresh, expired, or
// invalid — the failure modes show as clear errors rather than redirects.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthLayout } from '../components/AuthLayout';
import { Field } from '../components/Field';
import { Button } from '../components/Button';
import { t } from '../strings/pt-BR';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    // detectSessionInUrl picks up the access_token fragment; if it produces
    // a session here, we're in a valid recovery flow.
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError(t.signup.passwordHelp);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch {
      setError(t.resetPassword.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (hasRecoverySession === false) {
    return (
      <AuthLayout
        title={t.resetPassword.title}
        footer={
          <Link to="/forgot-password" className="font-medium text-[var(--color-text)] underline">
            {t.login.forgotPassword}
          </Link>
        }
      >
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{t.resetPassword.invalidLink}</span>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title={t.resetPassword.title}>
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-success)]/40 bg-emerald-50 px-3 py-2 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <span>{t.resetPassword.success}</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.resetPassword.title} subtitle={t.resetPassword.subtitle}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label={t.resetPassword.password}
          type="password"
          icon={Lock}
          autoComplete="new-password"
          minLength={10}
          required
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t.resetPassword.submitting : t.resetPassword.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
