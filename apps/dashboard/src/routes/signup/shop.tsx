// Step 2 of the sign-up wizard. Collects shop info and POSTs to
// /v1/auth/sign-up. On success, navigates to /signup/done with the email
// for the "verifique seu e-mail" landing.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { Field, SelectField } from '../../components/Field';
import { Button } from '../../components/Button';
import { api, ApiError } from '../../lib/api';
import { t } from '../../strings/pt-BR';
import type { PixKeyType } from '@cadeirapro/shared';

interface Step1State {
  email: string;
  password: string;
}

export function SignUpStep2Page() {
  const location = useLocation();
  const navigate = useNavigate();

  const carry = location.state as Step1State | null;

  // Refresh on this page wipes wizard state — bounce back to step 1.
  useEffect(() => {
    if (!carry?.email || !carry?.password) navigate('/signup', { replace: true });
  }, [carry, navigate]);

  const [shopName, setShopName] = useState('');
  const [cpfOrCnpj, setCpfOrCnpj] = useState('');
  const [primaryPixKey, setPrimaryPixKey] = useState('');
  const [primaryPixKeyType, setPrimaryPixKeyType] = useState<PixKeyType>('cpf');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!carry) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.signUp({
        email: carry.email,
        password: carry.password,
        shopName: shopName.trim(),
        cpfOrCnpj: cpfOrCnpj.replace(/\D/g, ''),
        primaryPixKey: primaryPixKey.trim(),
        primaryPixKeyType,
        ...(whatsappPhone ? { whatsappPhone: whatsappPhone.trim() } : {}),
      });
      navigate('/signup/done', { replace: true, state: { email: carry.email } });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'email_in_use') setError(t.signup.errors.emailInUse);
        else if (err.code === 'validation_failed') setError(t.signup.errors.pixFormat);
        else setError(t.signup.errors.generic);
      } else {
        setError(t.signup.errors.generic);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!carry) return null;

  return (
    <AuthLayout
      title={t.signup.step2Title}
      subtitle={t.signup.step2Subtitle}
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
          label={t.signup.shopName}
          required
          minLength={2}
          maxLength={80}
          value={shopName}
          onChange={(e) => setShopName(e.currentTarget.value)}
        />
        <Field
          label={t.signup.cpfOrCnpj}
          required
          inputMode="numeric"
          pattern="\d{11}|\d{14}"
          helper={t.signup.cpfOrCnpjHelp}
          value={cpfOrCnpj}
          onChange={(e) => setCpfOrCnpj(e.currentTarget.value.replace(/\D/g, ''))}
        />
        <SelectField
          label={t.signup.primaryPixKeyType}
          value={primaryPixKeyType}
          onChange={(e) => setPrimaryPixKeyType(e.currentTarget.value as PixKeyType)}
          options={[
            { value: 'cpf', label: t.signup.pixTypes.cpf },
            { value: 'cnpj', label: t.signup.pixTypes.cnpj },
            { value: 'email', label: t.signup.pixTypes.email },
            { value: 'phone', label: t.signup.pixTypes.phone },
            { value: 'random', label: t.signup.pixTypes.random },
          ]}
        />
        <Field
          label={t.signup.primaryPixKey}
          required
          value={primaryPixKey}
          onChange={(e) => setPrimaryPixKey(e.currentTarget.value)}
        />
        <Field
          label={t.signup.whatsappPhone}
          type="tel"
          placeholder="+5511999998888"
          helper={t.signup.whatsappPhoneHelp}
          value={whatsappPhone}
          onChange={(e) => setWhatsappPhone(e.currentTarget.value)}
        />
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t.signup.submitting : t.signup.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
