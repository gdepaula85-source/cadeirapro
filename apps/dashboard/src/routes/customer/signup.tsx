// Customer signup at /[slug]/signup. Single-step form: name + phone + email
// + password. Posts to /v1/public/orgs/:slug/customer/sign-up which creates
// the auth user and links to a clients row (creates one if no anonymous
// booking history exists for this phone). On success we sign in immediately
// (email_confirm: true on the API side skips verification for the MVP) and
// land on /[slug] — the customer home.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function CustomerSignUpPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+55');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('A senha precisa ter pelo menos 10 caracteres.');
      return;
    }
    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
      setError('Use o formato internacional, ex.: +5511999999999.');
      return;
    }
    setSubmitting(true);
    try {
      await api.customer.signUp(slug, { name, phone, email, password });
      // Auto sign-in: the API set email_confirm: true so the password works
      // immediately. If signin fails we still consider the account created
      // and route the user to /login with an explanatory message.
      try {
        await signIn(email, password);
        navigate(`/${slug}`, { replace: true });
      } catch {
        navigate(`/${slug}/login`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'email_in_use') {
          setError('Este e-mail já está cadastrado. Tente entrar.');
        } else if (err.code === 'phone_already_linked') {
          setError('Este telefone já tem conta nesta barbearia. Tente entrar.');
        } else if (err.code === 'public_org_not_found') {
          setError('Barbearia não encontrada.');
        } else {
          setError('Não foi possível criar sua conta. Tente novamente.');
        }
      } else {
        setError('Não foi possível criar sua conta. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfdf9] px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8">
          <Link
            to={`/${slug}/welcome`}
            className="text-xs font-medium uppercase tracking-wider text-[#647067] hover:text-[#101713]"
          >
            ← Voltar
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#101713]">Criar conta</h1>
          <p className="mt-1 text-sm text-[#647067]">
            Receba lembretes e acumule pontos a cada visita.
          </p>
        </header>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Nome completo" icon={User}>
            <input
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              className="w-full bg-transparent text-sm text-[#101713] placeholder-[#98a59b] focus:outline-none"
              placeholder="João Silva"
            />
          </Field>
          <Field label="Telefone (WhatsApp)" icon={Phone}>
            <input
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              className="w-full bg-transparent text-sm text-[#101713] placeholder-[#98a59b] focus:outline-none"
              placeholder="+5511999999999"
            />
          </Field>
          <Field label="E-mail" icon={Mail}>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="w-full bg-transparent text-sm text-[#101713] placeholder-[#98a59b] focus:outline-none"
              placeholder="seu@email.com"
            />
          </Field>
          <Field label="Senha" icon={Lock} helper="Mínimo de 10 caracteres.">
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="w-full bg-transparent text-sm text-[#101713] placeholder-[#98a59b] focus:outline-none"
              placeholder="••••••••••"
            />
          </Field>
          {error ? (
            <p className="text-sm font-medium text-[#b21f3a]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="block w-full rounded-2xl bg-[#176527] py-4 text-center text-base font-semibold text-white shadow-[0_14px_30px_rgb(23_101_39_/_0.25)] transition hover:bg-[#125020] disabled:opacity-60 disabled:hover:bg-[#176527]"
          >
            {submitting ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#647067]">
          Já tem conta?{' '}
          <Link
            to={`/${slug}/login`}
            className="font-semibold text-[#176527] underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  icon: Icon,
  helper,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-[#647067]">{label}</span>
      <div className="mt-1.5 flex items-center gap-3 rounded-2xl border border-[#dfe7dc] bg-white px-4 py-3 transition focus-within:border-[#176527]">
        <Icon size={18} className="shrink-0 text-[#647067]" />
        {children}
      </div>
      {helper ? <span className="mt-1 block text-[11px] text-[#98a59b]">{helper}</span> : null}
    </label>
  );
}
