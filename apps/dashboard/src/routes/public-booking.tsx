import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Scissors,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { AvailabilitySlot } from '@cadeirapro/shared';
import { api, ApiError, type PublicBarber, type PublicService } from '../lib/api';
import { formatBRL } from '../lib/format';
import { Field } from '../components/Field';
import { PublicThemeApplier } from '../components/PublicThemeApplier';
import { t } from '../strings/pt-BR';

interface FormState {
  serviceId: string;
  barberId: string;
  date: string;
  startsAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  serviceId: '',
  barberId: '',
  date: today(),
  startsAt: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
});

export function PublicBookingPage() {
  const { slug = '' } = useParams();
  const copy = t.publicBooking;
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [error, setError] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ['public-org', slug],
    queryFn: () => api.public.org(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const servicesQuery = useQuery({
    queryKey: ['public-services', slug],
    queryFn: () => api.public.services(slug),
    enabled: Boolean(slug),
  });

  const barbersQuery = useQuery({
    queryKey: ['public-barbers', slug, form.serviceId],
    queryFn: () => api.public.barbers(slug, form.serviceId || undefined),
    enabled: Boolean(slug && form.serviceId),
  });

  const availabilityQuery = useQuery({
    queryKey: ['public-availability', slug, form.serviceId, form.barberId, form.date],
    queryFn: () =>
      api.public.availability(slug, {
        serviceId: form.serviceId,
        barberId: form.barberId,
        date: form.date,
      }),
    enabled: Boolean(slug && form.serviceId && form.barberId && form.date),
  });

  const bookingMutation = useMutation({
    mutationFn: () =>
      api.public.createBooking(slug, {
        serviceId: form.serviceId,
        barberId: form.barberId,
        startsAt: form.startsAt,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || null,
        notes: form.notes || null,
      }),
    onSuccess: () => setError(null),
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'booking_overlap') setError(copy.errors.overlap);
      else if (err instanceof ApiError && err.code === 'validation_failed')
        setError(copy.errors.validation);
      else setError(copy.errors.generic);
    },
  });

  const services = servicesQuery.data ?? [];
  const barbers = barbersQuery.data ?? [];
  const slots = availabilityQuery.data ?? [];
  const selectedService = services.find((service) => service.id === form.serviceId) ?? null;
  const selectedBarber = barbers.find((barber) => barber.id === form.barberId) ?? null;
  const selectedSlot = slots.find((slot) => slot.startsAt === form.startsAt) ?? null;
  const shopName = orgQuery.data?.name ?? copy.titleFallback;

  useEffect(() => {
    setForm((current) => ({ ...current, barberId: '', startsAt: '' }));
  }, [form.serviceId]);

  useEffect(() => {
    setForm((current) => ({ ...current, startsAt: '' }));
  }, [form.barberId, form.date]);

  function submit(e: FormEvent) {
    e.preventDefault();
    bookingMutation.mutate();
  }

  const themeId = orgQuery.data?.themeId ?? null;

  if (orgQuery.isLoading) return <LoadingState label={copy.loadingShop} />;
  if (orgQuery.error) return <NotFoundState label={copy.errors.notFound} />;

  if (bookingMutation.isSuccess) {
    return (
      <>
        <PublicThemeApplier themeId={themeId} />
        <main className="min-h-screen bg-[var(--cp-bg)] px-4 py-8 text-[var(--cp-text)]">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <div className="rounded-[28px] border border-[var(--cp-border)] bg-white p-6 text-center shadow-[0_24px_70px_rgb(20_42_25_/_0.12)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--cp-primary-tint)] text-[var(--cp-primary)]">
              <CheckCircle2 size={34} />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--cp-text)]">
              {copy.confirmedTitle}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--cp-text-muted)]">{copy.confirmedBody}</p>
            <button
              type="button"
              className="mt-7 h-13 w-full rounded-[18px] bg-[var(--cp-accent)] px-5 text-sm font-semibold text-[var(--cp-accent-on)] shadow-[0_14px_30px_rgb(45_130_55_/_0.25)] transition hover:bg-[var(--cp-accent-hover)]"
              onClick={() => {
                setForm(emptyForm());
                bookingMutation.reset();
              }}
            >
              {copy.startOver}
            </button>
          </div>
        </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PublicThemeApplier themeId={themeId} />
      <main className="min-h-screen bg-[var(--cp-bg)] px-3 py-4 text-[var(--cp-text)] sm:px-6 sm:py-8">
      <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-5 lg:grid-cols-[410px_minmax(0,1fr)] lg:items-start">
        <BrandPanel
          shopName={shopName}
          coverUrl={orgQuery.data?.coverUrl ?? null}
          logoUrl={orgQuery.data?.logoUrl ?? null}
          selectedService={selectedService}
          selectedBarber={selectedBarber}
          selectedSlot={selectedSlot}
        />

        <form
          onSubmit={submit}
          className="w-full min-w-0 rounded-[30px] border border-[var(--cp-border)] bg-white p-4 shadow-[0_20px_60px_rgb(25_38_28_/_0.08)] sm:p-6"
        >
          <Header shopName={shopName} />

          <div className="mt-6 space-y-7">
            <ServiceStep
              services={services}
              selectedId={form.serviceId}
              isLoading={servicesQuery.isLoading}
              emptyLabel={copy.noServices}
              onSelect={(serviceId) => setForm({ ...form, serviceId })}
            />

            <BarberStep
              barbers={barbers}
              selectedId={form.barberId}
              disabled={!form.serviceId}
              isLoading={barbersQuery.isLoading}
              emptyLabel={copy.noBarbers}
              onSelect={(barberId) => setForm({ ...form, barberId })}
            />

            <ScheduleStep
              date={form.date}
              slots={slots}
              selectedSlot={form.startsAt}
              slotsDisabled={!form.serviceId || !form.barberId}
              slotsLoading={availabilityQuery.isFetching}
              emptyLabel={copy.noSlots}
              onDateSelect={(date) => setForm({ ...form, date })}
              onSlotSelect={(startsAt) => setForm({ ...form, startsAt })}
            />

            <CustomerStep form={form} onChange={setForm} />
          </div>

          {error ? (
            <p className="mt-5 rounded-[16px] bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <BookingSummary
            service={selectedService}
            barber={selectedBarber}
            slot={selectedSlot}
            isSubmitting={bookingMutation.isPending}
            canSubmit={Boolean(
              form.serviceId &&
              form.barberId &&
              form.startsAt &&
              form.customerName &&
              form.customerPhone,
            )}
          />
        </form>
      </section>
      </main>
    </>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cp-bg)] px-4 text-sm text-[var(--cp-text-muted)]">
      <Loader2 className="mr-2 animate-spin" size={18} />
      {label}
    </main>
  );
}

function NotFoundState({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cp-bg)] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--cp-border)] bg-white p-8 text-center shadow-[0_20px_60px_rgb(25_38_28_/_0.08)]">
        <Scissors className="mx-auto mb-3 text-[var(--cp-text-muted)]" size={28} />
        <h1 className="text-lg font-semibold text-[var(--cp-text)]">{label}</h1>
      </div>
    </main>
  );
}

function Header({ shopName }: { shopName: string }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--cp-primary-tint)] px-3 py-1 text-xs font-semibold text-[var(--cp-primary)]">
          <Sparkles size={13} />
          CadeiraPro
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--cp-text)] sm:text-3xl">
          {shopName}
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--cp-text-muted)]">{t.publicBooking.subtitle}</p>
      </div>
      <div className="hidden rounded-full border border-[var(--cp-border)] bg-white p-3 text-[var(--cp-primary)] shadow-sm sm:block">
        <Scissors size={20} />
      </div>
    </header>
  );
}

function BrandPanel({
  shopName,
  coverUrl,
  logoUrl,
  selectedService,
  selectedBarber,
  selectedSlot,
}: {
  shopName: string;
  coverUrl: string | null;
  logoUrl: string | null;
  selectedService: PublicService | null;
  selectedBarber: PublicBarber | null;
  selectedSlot: AvailabilitySlot | null;
}) {
  return (
    <aside className="w-full min-w-0 overflow-hidden rounded-[34px] bg-[var(--cp-surface-dark)] text-white shadow-[0_28px_80px_rgb(2_27_21_/_0.24)] lg:sticky lg:top-6">
      <div
        className="relative flex min-h-[360px] flex-col justify-between p-6"
        style={
          coverUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgb(2 27 21 / 0.3), rgb(2 27 21 / 0.92)), url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,var(--cp-accent-hover)_0,transparent_24%),linear-gradient(135deg,transparent_0_20%,rgb(255_255_255_/_0.16)_20%_21%,transparent_21%_100%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-13 w-13 rounded-2xl bg-white object-cover" />
            ) : (
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <Scissors size={24} />
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/55">Cadeira</p>
              <p className="text-sm font-semibold tracking-[0.35em] text-[var(--cp-accent-soft)]">PRO</p>
            </div>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">9:41</div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">{shopName}</h2>
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/72">
            {t.publicBooking.subtitle}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <SummaryLine
          icon={<Scissors size={16} />}
          label={selectedService?.name ?? t.publicBooking.service}
          value={
            selectedService ? formatBRL(selectedService.priceCents) : t.publicBooking.pickService
          }
        />
        <SummaryLine
          icon={<UserRound size={16} />}
          label={selectedBarber?.displayName ?? t.publicBooking.barber}
          value={selectedBarber ? 'Top Profissional' : t.publicBooking.pickBarber}
        />
        <SummaryLine
          icon={<Clock3 size={16} />}
          label={selectedSlot ? formatTime(selectedSlot.startsAt) : t.publicBooking.slot}
          value={
            selectedService ? `${selectedService.durationMinutes} min` : t.publicBooking.pickSlot
          }
        />
      </div>
    </aside>
  );
}

function SummaryLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/8 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-white/85">
        <span className="text-[var(--cp-accent-soft)]">{icon}</span>
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <span className="shrink-0 text-xs text-white/55">{value}</span>
    </div>
  );
}

function ServiceStep({
  services,
  selectedId,
  isLoading,
  emptyLabel,
  onSelect,
}: {
  services: PublicService[];
  selectedId: string;
  isLoading: boolean;
  emptyLabel: string;
  onSelect: (serviceId: string) => void;
}) {
  return (
    <section>
      <StepHeading
        step="01"
        title={t.publicBooking.service}
        subtitle={t.publicBooking.pickService}
      />
      {isLoading ? <InlineLoading /> : null}
      {!isLoading && services.length === 0 ? <EmptyNotice label={emptyLabel} /> : null}
      <div className="mt-3 grid gap-3">
        {services.map((service) => (
          <button
            type="button"
            key={service.id}
            onClick={() => onSelect(service.id)}
            className={`group grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 rounded-[22px] border p-3 text-left transition ${
              selectedId === service.id
                ? 'border-[var(--cp-primary)] bg-[var(--cp-primary-tint)] shadow-[0_14px_30px_rgb(45_130_55_/_0.14)]'
                : 'border-[var(--cp-border)] bg-white hover:border-[var(--cp-primary-soft)] hover:bg-[var(--cp-surface-soft)]'
            }`}
          >
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-[var(--cp-primary-tint)] text-[var(--cp-text)]">
              {service.photoUrl ? (
                <img
                  src={service.photoUrl}
                  alt=""
                  className="h-full w-full rounded-[18px] object-cover"
                />
              ) : (
                <Scissors size={28} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-[var(--cp-text)]">{service.name}</h3>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--cp-text-muted)]">
                {service.description || t.publicBooking.subtitle}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--cp-text-muted)]">
                <Clock3 size={14} />
                <span>{service.durationMinutes} min</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className="text-sm font-semibold text-[var(--cp-text)]">
                {formatBRL(service.priceCents)}
              </span>
              <ChevronRight
                size={18}
                className={selectedId === service.id ? 'text-[var(--cp-primary)]' : 'text-[var(--cp-text-muted)]'}
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function BarberStep({
  barbers,
  selectedId,
  disabled,
  isLoading,
  emptyLabel,
  onSelect,
}: {
  barbers: PublicBarber[];
  selectedId: string;
  disabled: boolean;
  isLoading: boolean;
  emptyLabel: string;
  onSelect: (barberId: string) => void;
}) {
  return (
    <section className={disabled ? 'opacity-55' : ''}>
      <StepHeading step="02" title={t.publicBooking.barber} subtitle={t.publicBooking.pickBarber} />
      {isLoading ? <InlineLoading /> : null}
      {!disabled && !isLoading && barbers.length === 0 ? <EmptyNotice label={emptyLabel} /> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {barbers.map((barber) => (
          <button
            type="button"
            key={barber.id}
            disabled={disabled}
            onClick={() => onSelect(barber.id)}
            className={`rounded-[24px] border p-4 text-left transition ${
              selectedId === barber.id
                ? 'border-[var(--cp-primary)] bg-[var(--cp-surface-dark-hi)] text-white shadow-[0_14px_35px_rgb(6_37_28_/_0.22)]'
                : 'border-[var(--cp-border)] bg-white text-[var(--cp-text)] hover:border-[var(--cp-primary-soft)]'
            }`}
          >
            <div className="flex items-center gap-3">
              {barber.avatarUrl ? (
                <img
                  src={barber.avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    selectedId === barber.id
                      ? 'bg-black/30 text-[var(--cp-accent-soft)]'
                      : 'bg-[var(--cp-primary-tint)] text-[var(--cp-primary)]'
                  }`}
                >
                  <UserRound size={25} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{barber.displayName}</h3>
                <div
                  className={`mt-1 flex items-center gap-1 text-xs ${
                    selectedId === barber.id ? 'text-[var(--cp-accent-soft)]' : 'text-[var(--cp-text-muted)]'
                  }`}
                >
                  <Star size={13} className="fill-current" />
                  <span>{barber.ratingAverage ? formatRating(barber.ratingAverage) : '--'}</span>
                  {barber.ratingCount > 0 ? <span>({barber.ratingCount})</span> : null}
                </div>
              </div>
            </div>
            {barber.bio ? (
              <p
                className={`mt-3 line-clamp-2 text-sm leading-5 ${
                  selectedId === barber.id ? 'text-white/72' : 'text-[var(--cp-text-muted)]'
                }`}
              >
                {barber.bio}
              </p>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function ScheduleStep({
  date,
  slots,
  selectedSlot,
  slotsDisabled,
  slotsLoading,
  emptyLabel,
  onDateSelect,
  onSlotSelect,
}: {
  date: string;
  slots: AvailabilitySlot[];
  selectedSlot: string;
  slotsDisabled: boolean;
  slotsLoading: boolean;
  emptyLabel: string;
  onDateSelect: (date: string) => void;
  onSlotSelect: (startsAt: string) => void;
}) {
  return (
    <section>
      <StepHeading step="03" title={t.publicBooking.date} subtitle={t.publicBooking.pickSlot} />
      <DateStrip selectedDate={date} onSelect={onDateSelect} />
      <div className={slotsDisabled ? 'mt-4 opacity-55' : 'mt-4'}>
        {slotsLoading ? <InlineLoading /> : null}
        {!slotsLoading ? (
          <SlotGrid
            slots={slots}
            selected={selectedSlot}
            disabled={slotsDisabled}
            emptyLabel={emptyLabel}
            onSelect={onSlotSelect}
          />
        ) : null}
      </div>
    </section>
  );
}

function CustomerStep({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (form: FormState) => void;
}) {
  const copy = t.publicBooking;
  return (
    <section>
      <StepHeading step="04" title={copy.customerName} subtitle={copy.customerPhoneHelp} />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field
          label={copy.customerName}
          required
          value={form.customerName}
          className="h-12 rounded-[16px] border-[var(--cp-border)] bg-[var(--cp-surface-soft)]"
          onChange={(e) => onChange({ ...form, customerName: e.currentTarget.value })}
        />
        <Field
          label={copy.customerPhone}
          required
          value={form.customerPhone}
          helper={copy.customerPhoneHelp}
          className="h-12 rounded-[16px] border-[var(--cp-border)] bg-[var(--cp-surface-soft)]"
          onChange={(e) => onChange({ ...form, customerPhone: e.currentTarget.value })}
        />
        <Field
          label={copy.customerEmail}
          type="email"
          value={form.customerEmail}
          className="h-12 rounded-[16px] border-[var(--cp-border)] bg-[var(--cp-surface-soft)]"
          onChange={(e) => onChange({ ...form, customerEmail: e.currentTarget.value })}
        />
        <Field
          label={copy.notes}
          value={form.notes}
          className="h-12 rounded-[16px] border-[var(--cp-border)] bg-[var(--cp-surface-soft)]"
          onChange={(e) => onChange({ ...form, notes: e.currentTarget.value })}
        />
      </div>
    </section>
  );
}

function BookingSummary({
  service,
  barber,
  slot,
  canSubmit,
  isSubmitting,
}: {
  service: PublicService | null;
  barber: PublicBarber | null;
  slot: AvailabilitySlot | null;
  canSubmit: boolean;
  isSubmitting: boolean;
}) {
  return (
    <div className="mt-7 rounded-[24px] border border-[var(--cp-border)] bg-white/95 p-3 shadow-[0_16px_45px_rgb(20_42_25_/_0.16)] backdrop-blur lg:sticky lg:bottom-3">
      <div className="mb-3 grid gap-1 rounded-[18px] bg-[var(--cp-surface-soft)] px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--cp-text)]">
            {service?.name ?? t.publicBooking.pickService}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--cp-text-muted)]">
            {slot ? formatDateTime(slot.startsAt) : t.publicBooking.pickSlot}
            {barber ? ` | ${barber.displayName}` : ''}
          </p>
        </div>
        <p className="text-sm font-semibold text-[var(--cp-text)]">
          {service ? formatBRL(service.priceCents) : '--'}
        </p>
      </div>
      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="flex h-14 w-full items-center justify-center rounded-[20px] bg-[var(--cp-accent)] px-5 text-sm font-semibold text-[var(--cp-accent-on)] shadow-[0_16px_30px_rgb(45_130_55_/_0.25)] transition hover:bg-[var(--cp-accent-hover)] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 animate-spin" size={17} />
            {t.publicBooking.submitting}
          </>
        ) : (
          t.publicBooking.submit
        )}
      </button>
    </div>
  );
}

function StepHeading({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-[var(--cp-primary)]">{step}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--cp-text)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--cp-text-muted)]">{subtitle}</p>
      </div>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--cp-border)]">
        <div className="h-full w-1/2 rounded-full bg-[var(--cp-primary)]" />
      </div>
    </div>
  );
}

function DateStrip({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const dates = useMemo(() => {
    const start = new Date(`${today()}T12:00:00Z`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const iso = date.toISOString().slice(0, 10);
      return {
        iso,
        weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
          .format(date)
          .replace('.', ''),
        day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'UTC' }).format(date),
        month: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
          .format(date)
          .replace('.', ''),
      };
    });
  }, []);

  return (
    <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
      {dates.map((date) => (
        <button
          type="button"
          key={date.iso}
          onClick={() => onSelect(date.iso)}
          className={`grid min-w-[72px] justify-items-center rounded-[18px] border px-3 py-3 text-sm transition ${
            selectedDate === date.iso
              ? 'border-[var(--cp-primary)] bg-[var(--cp-primary)] text-white shadow-[0_12px_24px_rgb(23_101_39_/_0.2)]'
              : 'border-[var(--cp-border)] bg-white text-[var(--cp-text-muted)] hover:border-[var(--cp-primary-soft)]'
          }`}
        >
          <span className="text-xs capitalize opacity-75">{date.weekday}</span>
          <span className="mt-1 text-lg font-semibold">{date.day}</span>
          <span className="text-xs capitalize opacity-75">{date.month}</span>
        </button>
      ))}
    </div>
  );
}

function SlotGrid({
  slots,
  selected,
  disabled,
  emptyLabel,
  onSelect,
}: {
  slots: AvailabilitySlot[];
  selected: string;
  disabled: boolean;
  emptyLabel: string;
  onSelect: (startsAt: string) => void;
}) {
  if (slots.length === 0) return <EmptyNotice label={emptyLabel} />;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => (
        <button
          type="button"
          key={slot.startsAt}
          disabled={disabled}
          onClick={() => onSelect(slot.startsAt)}
          className={`h-12 rounded-[16px] border text-sm font-semibold transition ${
            selected === slot.startsAt
              ? 'border-[var(--cp-surface-dark-hi)] bg-[var(--cp-surface-dark-hi)] text-white shadow-[0_12px_26px_rgb(6_37_28_/_0.22)]'
              : 'border-[var(--cp-border)] bg-white text-[var(--cp-text)] hover:border-[var(--cp-primary-soft)]'
          }`}
        >
          {formatTime(slot.startsAt)}
        </button>
      ))}
    </div>
  );
}

function InlineLoading() {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-[var(--cp-border)] bg-[var(--cp-surface-soft)] px-4 py-3 text-sm text-[var(--cp-text-muted)]">
      <Loader2 className="animate-spin" size={16} />
      {t.common.loading}
    </div>
  );
}

function EmptyNotice({ label }: { label: string }) {
  return (
    <p className="mt-3 rounded-[18px] border border-dashed border-[var(--cp-border)] bg-[var(--cp-surface-soft)] px-4 py-4 text-sm text-[var(--cp-text-muted)]">
      {label}
    </p>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function formatRating(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
    .format(new Date(value))
    .replace('.', '');
}
