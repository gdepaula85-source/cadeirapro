// Step 1 of the sign-up wizard. Collects email + password, then hands off
// to /signup/shop via React Router state. No API call here — everything is
// submitted in step 2.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { t } from '../../strings/pt-BR';

export function SignUpStep1Page() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError(t.signup.passwordHelp);
      return;
    }
    navigate('/signup/shop', { state: { email, password } });
  }

  return (
    <AuthLayout
      title={t.signup.step1Title}
      subtitle={t.signup.step1Subtitle}
      footer={
        <>
          {t.signup.haveAccount}{' '}
          <Link to="/login" className="text-[var(--color-text)] underline">
            {t.signup.signIn}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label={t.signup.email}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <Field
          label={t.signup.password}
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          helper={t.signup.passwordHelp}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t.signup.next}
        </Button>
      </form>
    </AuthLayout>
  );
}
