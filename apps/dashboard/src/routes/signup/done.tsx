// Step 3 — "verifique seu e-mail" landing. The user clicks the link in their
// inbox; Supabase redirects back to the dashboard's Site URL with a session
// in the URL fragment (detectSessionInUrl handles this in lib/supabase.ts),
// so on return they end up at /signup/done with a live session and can
// proceed via "Já confirmei".
import { Link, useLocation } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { Button } from '../../components/Button';
import { t } from '../../strings/pt-BR';

export function SignUpDonePage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  return (
    <AuthLayout
      title={t.signup.step3Title}
      subtitle={t.signup.step3Body}
      step={{ current: 3, total: 3 }}
    >
      <div className="flex flex-col items-center gap-4 mb-2">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full"
          style={{ background: 'var(--color-surface-muted)' }}
          aria-hidden
        >
          <MailCheck size={26} className="text-[var(--color-text)]" />
        </div>
        {email ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            {t.signup.email}: <span className="font-medium text-[var(--color-text)]">{email}</span>
          </p>
        ) : null}
      </div>
      <Link to="/login" className="block mt-2">
        <Button className="w-full">{t.signup.step3OpenLogin}</Button>
      </Link>
    </AuthLayout>
  );
}
