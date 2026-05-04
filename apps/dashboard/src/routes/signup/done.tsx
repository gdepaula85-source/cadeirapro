// Step 3 — "verifique seu e-mail" landing. The user clicks the link in their
// inbox; Supabase redirects back to the dashboard's Site URL with a session
// in the URL fragment (detectSessionInUrl handles this in lib/supabase.ts),
// so on return they end up at /signup/done with a live session and can
// proceed via "Já confirmei".
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { Button } from '../../components/Button';
import { t } from '../../strings/pt-BR';

export function SignUpDonePage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  return (
    <AuthLayout title={t.signup.step3Title} subtitle={t.signup.step3Body}>
      {email ? (
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {t.signup.email}: <span className="font-medium text-[var(--color-text)]">{email}</span>
        </p>
      ) : null}
      <Link to="/login" className="block">
        <Button className="w-full">{t.signup.step3OpenLogin}</Button>
      </Link>
    </AuthLayout>
  );
}
