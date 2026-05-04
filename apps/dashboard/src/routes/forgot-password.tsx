// Request a password-reset email. The redirect URL is origin-aware (via
// authRedirectUrl in lib/auth.tsx) so links work whether the user is on
// localhost dev or staging Pages.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Mail, MailCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Field } from '../components/Field';
import { Button } from '../components/Button';
import { t } from '../strings/pt-BR';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError(t.forgotPassword.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title={t.forgotPassword.sentTitle}
        subtitle={t.forgotPassword.sentBody}
        footer={
          <Link
            to="/login"
            className="inline-flex items-center gap-1 font-medium text-[var(--color-text)] hover:underline"
          >
            <ArrowLeft size={14} />
            {t.forgotPassword.backToLogin}
          </Link>
        }
      >
        <div
          className="flex items-center justify-center w-12 h-12 mx-auto rounded-full"
          style={{ background: 'var(--color-surface-muted)' }}
          aria-hidden
        >
          <MailCheck size={22} className="text-[var(--color-text)]" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t.forgotPassword.title}
      subtitle={t.forgotPassword.subtitle}
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1 font-medium text-[var(--color-text)] hover:underline"
        >
          <ArrowLeft size={14} />
          {t.forgotPassword.backToLogin}
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label={t.forgotPassword.email}
          type="email"
          icon={Mail}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t.forgotPassword.submitting : t.forgotPassword.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
