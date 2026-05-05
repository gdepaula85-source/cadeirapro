import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  Crown,
  LogOut,
  Phone,
  Scissors,
  Sparkles,
  Star,
  UserRound,
  WalletCards,
} from 'lucide-react';
import type { CustomerBookingSummary } from '@cadeirapro/shared';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatBRL, formatPhone } from '../../lib/format';
import { PublicThemeApplier } from '../../components/PublicThemeApplier';

export function CustomerProfilePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { session, loading, signOut } = useAuth();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['customer', 'me'],
    queryFn: () => api.customer.me(),
    enabled: !!session,
    retry: false,
  });

  const reviewMutation = useMutation({
    mutationFn: api.customer.createReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', 'me'] }),
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--cp-bg)] text-sm text-[var(--cp-text-muted)]">
        ...
      </main>
    );
  }

  if (!session) return <Navigate to={`/${slug}/welcome`} replace />;
  if (meQuery.error instanceof ApiError && meQuery.error.code === 'not_a_customer') {
    return <Navigate to="/" replace />;
  }

  const me = meQuery.data;
  const themeId = me?.organization.themeId ?? null;

  return (
    <>
    <PublicThemeApplier themeId={themeId} />
    <main className="min-h-screen bg-[var(--cp-bg)] px-4 py-5 text-[var(--cp-text)]">
      <div className="mx-auto w-full max-w-md pb-8">
        <header className="flex items-center justify-between">
          <Link
            to={`/${slug}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--cp-border)] bg-white text-[var(--cp-text)] shadow-sm"
            aria-label="Voltar"
          >
            <ArrowLeft size={19} />
          </Link>
          <p className="text-sm font-semibold">{me?.organization.name ?? 'Perfil'}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--cp-border)] bg-white text-[var(--cp-text-muted)] shadow-sm"
            aria-label="Sair"
          >
            <LogOut size={17} />
          </button>
        </header>

        <section className="mt-5 overflow-hidden rounded-[32px] bg-[var(--cp-surface-dark)] text-white shadow-[0_22px_60px_rgb(2_27_21_/_0.22)]">
          <div className="relative p-6">
            <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(circle_at_18%_12%,var(--cp-accent-soft)_0,transparent_26%),linear-gradient(135deg,transparent_0_24%,rgb(255_255_255_/_0.18)_24%_25%,transparent_25%_100%)]" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-black/28 text-[var(--cp-accent-soft)]">
                <UserRound size={34} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Cadeira Club</p>
                <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">
                  {me?.customer.name ?? 'Carregando...'}
                </h1>
                <p className="mt-2 text-sm text-white/64">
                  Cliente desde {me ? formatDate(me.stats.memberSince) : '--'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-white/10">
            <ProfileStat label="Visitas" value={String(me?.stats.completedBookings ?? '--')} />
            <ProfileStat label="Agendados" value={String(me?.stats.upcomingBookings ?? '--')} />
            <ProfileStat
              label="Total gasto"
              value={me ? formatBRL(me.stats.totalSpentCents) : '--'}
            />
          </div>
        </section>

        <section className="mt-4 grid gap-3 rounded-[28px] border border-[var(--cp-border)] bg-white p-4 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
          <InfoRow
            icon={<Phone size={16} />}
            label="Telefone"
            value={me ? formatPhone(me.customer.phone) : '--'}
          />
          <InfoRow
            icon={<WalletCards size={16} />}
            label="E-mail"
            value={me?.customer.email ?? 'Nao informado'}
          />
          <InfoRow
            icon={<Crown size={16} />}
            label="Nivel"
            value={loyaltyTier(me?.stats.totalSpentCents ?? 0)}
          />
        </section>

        <BookingsSection
          title="Proximos horarios"
          empty="Nenhum horario agendado."
          bookings={me?.upcomingBookings ?? []}
        />
        <BookingsSection
          title="Historico"
          empty="Seu historico aparecera aqui apos o primeiro atendimento."
          bookings={me?.pastBookings ?? []}
          onReview={(bookingId, rating, comment) =>
            reviewMutation.mutateAsync({ bookingId, rating, comment })
          }
        />

        <Link
          to={`/book/${slug}`}
          className="mt-5 flex h-14 items-center justify-center rounded-[20px] bg-[var(--cp-accent)] px-5 text-sm font-semibold text-[var(--cp-accent-on)] shadow-[0_16px_30px_rgb(45_130_55_/_0.25)] transition hover:bg-[var(--cp-accent-hover)]"
        >
          Reservar novo horario
        </Link>
      </div>
    </main>
    </>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <p className="text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-[11px] text-white/55">{label}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--cp-surface-soft)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-[var(--cp-text-muted)]">
        <span className="text-[var(--cp-primary)]">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="truncate text-right text-sm font-semibold text-[var(--cp-text)]">{value}</span>
    </div>
  );
}

function BookingsSection({
  title,
  empty,
  bookings,
  onReview,
}: {
  title: string;
  empty: string;
  bookings: CustomerBookingSummary[];
  onReview?: (bookingId: string, rating: number, comment: string | null) => Promise<unknown>;
}) {
  return (
    <section className="mt-5 rounded-[28px] border border-[var(--cp-border)] bg-white p-4 shadow-[0_14px_36px_rgb(25_38_28_/_0.06)]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--cp-text)]">{title}</h2>
        <Sparkles size={17} className="text-[var(--cp-primary)]" />
      </div>
      <div className="mt-4 space-y-3">
        {bookings.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-[var(--cp-border)] bg-[var(--cp-surface-soft)] px-4 py-5 text-sm text-[var(--cp-text-muted)]">
            {empty}
          </p>
        ) : (
          bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onReview={onReview} />
          ))
        )}
      </div>
    </section>
  );
}

function BookingCard({
  booking,
  onReview,
}: {
  booking: CustomerBookingSummary;
  onReview?: (bookingId: string, rating: number, comment: string | null) => Promise<unknown>;
}) {
  const canReview = booking.status === 'completed' && !booking.reviewId && onReview;

  return (
    <article className="rounded-[20px] border border-[var(--cp-border)] bg-white px-3 py-3">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--cp-primary-tint)] text-[var(--cp-primary)]">
          <Scissors size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--cp-text)]">
            {booking.serviceName ?? 'Servico'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--cp-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} />
              {formatDate(booking.startsAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 size={13} />
              {formatTime(booking.startsAt)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--cp-text-muted)]">{booking.barberName ?? 'Barbeiro'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--cp-primary-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cp-primary)]">
            {booking.reviewRating ? `Nota ${booking.reviewRating}/5` : statusLabel(booking.status)}
          </span>
          <ChevronRight size={15} className="text-[var(--cp-text-muted)]" />
        </div>
      </div>
      {canReview ? <ReviewForm bookingId={booking.id} onReview={onReview} /> : null}
    </article>
  );
}

function ReviewForm({
  bookingId,
  onReview,
}: {
  bookingId: string;
  onReview: (bookingId: string, rating: number, comment: string | null) => Promise<unknown>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await onReview(bookingId, rating, comment.trim() || null);
    } catch (err) {
      setError(err instanceof ApiError ? reviewErrorLabel(err.code) : 'Nao foi possivel avaliar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-[18px] bg-[var(--cp-surface-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--cp-text)]">Avalie o atendimento</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--cp-primary)] transition hover:bg-[var(--cp-primary-tint)]"
              aria-label={`Dar nota ${value}`}
            >
              <Star size={16} fill={value <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={1000}
        rows={2}
        className="mt-2 w-full resize-none rounded-2xl border border-[var(--cp-border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--cp-primary)]"
        placeholder="Conte como foi"
      />
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className="mt-2 w-full rounded-2xl bg-[var(--cp-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--cp-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Enviando...' : 'Enviar avaliacao'}
      </button>
    </div>
  );
}

function loyaltyTier(totalSpentCents: number): string {
  if (totalSpentCents >= 150_000) return 'Diamante';
  if (totalSpentCents >= 50_000) return 'Ouro';
  return 'Prata';
}

function statusLabel(status: CustomerBookingSummary['status']): string {
  const labels: Record<CustomerBookingSummary['status'], string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluido',
    no_show: 'No-show',
    cancelled: 'Cancelado',
  };
  return labels[status];
}

function reviewErrorLabel(code: string): string {
  if (code === 'already_reviewed') return 'Este horario ja foi avaliado.';
  if (code === 'booking_not_reviewable')
    return 'Apenas atendimentos concluidos podem ser avaliados.';
  return 'Nao foi possivel avaliar.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
    .format(new Date(value))
    .replace('.', '');
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
