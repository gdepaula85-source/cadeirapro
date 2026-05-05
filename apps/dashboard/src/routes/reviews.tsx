import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Star } from 'lucide-react';
import type { Review } from '@cadeirapro/shared';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { t } from '../strings/pt-BR';

export function ReviewsPage() {
  const qc = useQueryClient();
  const reviewsQuery = useQuery({ queryKey: ['reviews'], queryFn: api.reviews.list });
  const visibilityMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.reviews.setVisibility(id, isPublic),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });

  const reviews = reviewsQuery.data ?? [];
  const stats = useMemo(() => reviewStats(reviews), [reviews]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Star size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">{t.common.sprint2}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)] md:text-3xl">
            {t.reviews.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
            {t.reviews.subtitle}
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label={t.reviews.metrics.average} value={stats.averageLabel} />
        <Metric label={t.reviews.metrics.total} value={String(reviews.length)} />
        <Metric label={t.reviews.metrics.public} value={String(stats.publicCount)} />
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-medium">
          {reviewsQuery.isLoading ? t.common.loading : `${reviews.length} ${t.reviews.countLabel}`}
        </div>
        {reviews.length === 0 && !reviewsQuery.isLoading ? (
          <div className="p-8 text-sm text-[var(--color-text-muted)]">{t.common.empty}</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {reviews.map((review) => (
              <article key={review.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Rating rating={review.rating} />
                    <h2 className="font-medium text-[var(--color-text)]">
                      {review.clientName ?? t.clients.title}
                    </h2>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {review.serviceName ?? t.services.title} ·{' '}
                    {review.barberName ?? t.staff.roles.barber}
                  </p>
                  {review.comment ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text)]">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                      {t.reviews.noComment}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      review.isPublic
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {review.isPublic ? t.reviews.public : t.reviews.hidden}
                  </span>
                  <Button
                    variant="secondary"
                    className="px-3"
                    loading={visibilityMutation.isPending}
                    onClick={() =>
                      visibilityMutation.mutate({ id: review.id, isPublic: !review.isPublic })
                    }
                  >
                    {review.isPublic ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span className="sr-only">
                      {review.isPublic ? t.reviews.hide : t.reviews.show}
                    </span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function Rating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#edf7e9] px-2 py-1 text-xs font-semibold text-[#176527]">
      <Star size={13} className="fill-current" />
      {rating}/5
    </span>
  );
}

function reviewStats(reviews: Review[]) {
  const publicCount = reviews.filter((review) => review.isPublic).length;
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;
  return {
    publicCount,
    averageLabel: average === null ? t.common.none : formatRating(average),
  };
}

function formatRating(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(value))
    .replace('.', '');
}
