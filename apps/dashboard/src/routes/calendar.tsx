// Day-view calendar. Single barber per view, 08:00-20:00 grid (1 minute = 1px),
// bookings rendered as positioned blocks. "Novo agendamento" opens a modal that
// pulls available slots from /v1/availability for the selected (barber, service,
// date) combination.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import type {
  AvailabilitySlot,
  Booking,
  BookingStatus,
  Client,
  Service,
  Staff,
} from '@cadeirapro/shared';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { Field, SelectField } from '../components/Field';
import { formatBRL } from '../lib/format';
import { t } from '../strings/pt-BR';

const HOUR_START = 8; // 08:00
const HOUR_END = 20; // 20:00
const PIXELS_PER_MINUTE = 1;
const GRID_HEIGHT_PX = (HOUR_END - HOUR_START) * 60 * PIXELS_PER_MINUTE;

function ymdToday(): string {
  const d = new Date();
  // Use local timezone (the user's browser is in shop tz for staging dev).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDate(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function dayBoundsUtc(ymd: string): { from: string; to: string } {
  // Pad ±1 day so any timezone offset still picks up the relevant rows.
  const fromMs = new Date(`${ymd}T00:00:00Z`).getTime() - 24 * 60 * 60_000;
  const toMs = new Date(`${ymd}T23:59:59Z`).getTime() + 24 * 60 * 60_000;
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
}

function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function shortHourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  confirmed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  completed: 'border-slate-300 bg-slate-50 text-slate-900',
  no_show: 'border-rose-300 bg-rose-50 text-rose-900',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500 line-through opacity-60',
};

interface BookingFormState {
  serviceId: string;
  clientId: string;
  startsAt: string; // ISO UTC
  notes: string;
}

const emptyBookingForm: BookingFormState = {
  serviceId: '',
  clientId: '',
  startsAt: '',
  notes: '',
};

export function CalendarPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(ymdToday());
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingFormState>(emptyBookingForm);
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({ queryKey: ['staff', false], queryFn: () => api.staff.list(false) });
  const servicesQuery = useQuery({
    queryKey: ['services', false],
    queryFn: () => api.services.list(false),
  });
  const clientsQuery = useQuery({ queryKey: ['clients', ''], queryFn: () => api.clients.list('') });

  // Default to the first barber (role='barber') once staff loads.
  useEffect(() => {
    if (selectedBarberId) return;
    const firstBarber = staffQuery.data?.find((s) => s.role === 'barber') ?? staffQuery.data?.[0];
    if (firstBarber) setSelectedBarberId(firstBarber.id);
  }, [staffQuery.data, selectedBarberId]);

  const range = useMemo(() => dayBoundsUtc(date), [date]);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', date, selectedBarberId],
    queryFn: () =>
      api.bookings.list({
        from: range.from,
        to: range.to,
        ...(selectedBarberId ? { barberId: selectedBarberId } : {}),
      }),
    enabled: !!selectedBarberId,
  });

  // Filter bookings to the chosen calendar day in local time.
  const bookingsForDay = useMemo(() => {
    const all = bookingsQuery.data ?? [];
    return all
      .filter((b) => b.status !== 'cancelled')
      .filter((b) => {
        const local = new Date(b.startsAt);
        const y = local.getFullYear();
        const m = String(local.getMonth() + 1).padStart(2, '0');
        const d = String(local.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === date;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [bookingsQuery.data, date]);

  const availabilityQuery = useQuery({
    queryKey: ['availability', selectedBarberId, bookingForm.serviceId, date],
    queryFn: () =>
      api.availability.list({
        barberId: selectedBarberId,
        serviceId: bookingForm.serviceId,
        date,
      }),
    enabled: bookingFormOpen && !!selectedBarberId && !!bookingForm.serviceId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.bookings.create({
        clientId: bookingForm.clientId,
        barberId: selectedBarberId,
        serviceId: bookingForm.serviceId,
        startsAt: bookingForm.startsAt,
        status: 'confirmed',
        source: 'manual',
        notes: bookingForm.notes || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['bookings'] });
      setBookingFormOpen(false);
      setBookingForm(emptyBookingForm);
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'booking_overlap') {
        setError(t.calendar.errors.overlap);
        return;
      }
      setError(t.calendar.errors.generic);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.bookings.cancel(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['bookings'] }),
    onError: () => setError(t.calendar.errors.cancel),
  });

  const barbers = useMemo(
    () => (staffQuery.data ?? []).filter((s) => s.role === 'barber' && s.isActive),
    [staffQuery.data],
  );
  const activeServices = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.isActive),
    [servicesQuery.data],
  );
  const clientOptions = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  const dependenciesMissing =
    barbers.length === 0 || activeServices.length === 0 || clientOptions.length === 0;

  function openNewBooking() {
    setError(null);
    setBookingForm(emptyBookingForm);
    setBookingFormOpen(true);
  }

  function onBookingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookingForm.serviceId || !bookingForm.clientId || !bookingForm.startsAt) return;
    createMutation.mutate();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <CalendarDays size={16} />
            <span className="text-xs uppercase tracking-wider font-medium">{t.common.sprint2}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-1">
            {t.calendar.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
            {t.calendar.subtitle}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="calendar-date"
              className="block text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)] mb-1"
            >
              Data
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDate(shiftDate(date, -1))}
                aria-label="Dia anterior"
                className="p-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                id="calendar-date"
                type="date"
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.currentTarget.value)}
              />
              <button
                onClick={() => setDate(shiftDate(date, 1))}
                aria-label="Próximo dia"
                className="p-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
              >
                <ChevronRight size={16} />
              </button>
              <Button variant="secondary" onClick={() => setDate(ymdToday())} className="ml-1">
                {t.calendar.today}
              </Button>
            </div>
          </div>
          <div className="min-w-[200px]">
            <SelectField
              label={t.calendar.barber}
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.currentTarget.value)}
              options={[
                { value: '', label: t.calendar.selectBarber },
                ...barbers.map((b: Staff) => ({ value: b.id, label: b.displayName })),
              ]}
            />
          </div>
        </div>
        <Button
          onClick={openNewBooking}
          disabled={dependenciesMissing || !selectedBarberId}
          className="gap-2"
        >
          <Plus size={15} />
          {t.calendar.newBooking}
        </Button>
      </div>

      {dependenciesMissing ? (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)] space-y-1">
          {barbers.length === 0 ? <div>• {t.calendar.noBarbers}</div> : null}
          {activeServices.length === 0 ? <div>• {t.calendar.noServices}</div> : null}
          {clientOptions.length === 0 ? <div>• {t.calendar.noClients}</div> : null}
        </div>
      ) : (
        <DayGrid
          bookings={bookingsForDay}
          loading={bookingsQuery.isLoading}
          onCancel={(id) => {
            if (window.confirm(t.calendar.cancelConfirm)) cancelMutation.mutate(id);
          }}
        />
      )}

      {bookingFormOpen ? (
        <BookingFormModal
          form={bookingForm}
          setForm={setBookingForm}
          onClose={() => setBookingFormOpen(false)}
          onSubmit={onBookingSubmit}
          submitting={createMutation.isPending}
          error={error}
          services={activeServices}
          clients={clientOptions}
          slots={availabilityQuery.data ?? []}
          slotsLoading={availabilityQuery.isLoading}
        />
      ) : null}
    </div>
  );
}

function DayGrid({
  bookings,
  loading,
  onCancel,
}: {
  bookings: Booking[];
  loading: boolean;
  onCancel: (id: string) => void;
}) {
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    [],
  );

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium">
        {loading
          ? t.common.loading
          : bookings.length === 0
            ? t.calendar.noBookings
            : `${bookings.length} ${t.calendar.title.toLowerCase()}`}
      </div>
      <div className="relative">
        <div className="relative" style={{ height: GRID_HEIGHT_PX }} aria-label="Grade da agenda">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-[var(--color-border)]/60 flex"
              style={{ top: (h - HOUR_START) * 60 * PIXELS_PER_MINUTE }}
            >
              <div className="w-16 shrink-0 -mt-2.5 px-3 text-[11px] text-[var(--color-text-muted)] tabular-nums">
                {shortHourLabel(h)}
              </div>
            </div>
          ))}

          <div className="absolute left-16 right-3 top-0 bottom-0">
            {bookings.map((b) => {
              const startMin = minutesFromMidnight(b.startsAt) - HOUR_START * 60;
              const endMin = minutesFromMidnight(b.endsAt) - HOUR_START * 60;
              if (endMin <= 0 || startMin >= GRID_HEIGHT_PX) return null;
              const top = Math.max(0, startMin) * PIXELS_PER_MINUTE;
              const height = Math.max(20, (endMin - startMin) * PIXELS_PER_MINUTE);
              return (
                <article
                  key={b.id}
                  className={`absolute left-0 right-0 rounded-md border px-2 py-1 text-xs shadow-xs overflow-hidden ${STATUS_CLASS[b.status as BookingStatus] ?? STATUS_CLASS.pending}`}
                  style={{ top, height }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.clientName ?? '—'}</div>
                      <div className="text-[11px] opacity-80 truncate">
                        {b.serviceName ?? '—'}
                        {b.servicePriceCents != null ? ` · ${formatBRL(b.servicePriceCents)}` : ''}
                      </div>
                    </div>
                    {b.status !== 'cancelled' && b.status !== 'completed' ? (
                      <button
                        onClick={() => onCancel(b.id)}
                        className="shrink-0 -mr-1 -mt-1 p-1 rounded hover:bg-black/5"
                        aria-label={t.calendar.cancelBooking}
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingFormModal({
  form,
  setForm,
  onClose,
  onSubmit,
  submitting,
  error,
  services,
  clients,
  slots,
  slotsLoading,
}: {
  form: BookingFormState;
  setForm: (updater: BookingFormState | ((s: BookingFormState) => BookingFormState)) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  error: string | null;
  services: Service[];
  clients: Client[];
  slots: AvailabilitySlot[];
  slotsLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col shadow-lg">
        <header className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-base font-semibold">{t.calendar.newBooking}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <SelectField
            label={t.calendar.booking.service}
            value={form.serviceId}
            onChange={(e) =>
              setForm((s) => ({ ...s, serviceId: e.currentTarget.value, startsAt: '' }))
            }
            options={[
              { value: '', label: t.calendar.booking.pickService },
              ...services.map((srv) => ({
                value: srv.id,
                label: `${srv.name} · ${srv.durationMinutes}${t.common.minutesShort} · ${formatBRL(srv.priceCents)}`,
              })),
            ]}
          />
          <SelectField
            label={t.calendar.booking.client}
            value={form.clientId}
            onChange={(e) => setForm((s) => ({ ...s, clientId: e.currentTarget.value }))}
            options={[
              { value: '', label: t.calendar.booking.pickClient },
              ...clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` })),
            ]}
          />
          <SelectField
            label={t.calendar.booking.slot}
            value={form.startsAt}
            onChange={(e) => setForm((s) => ({ ...s, startsAt: e.currentTarget.value }))}
            disabled={!form.serviceId || slotsLoading}
            options={[
              {
                value: '',
                label: form.serviceId
                  ? slotsLoading
                    ? t.common.loading
                    : slots.length === 0
                      ? t.calendar.noSlots
                      : t.calendar.booking.pickSlot
                  : t.calendar.booking.pickService,
              },
              ...slots.map((s) => ({
                value: s.startsAt,
                label: new Date(s.startsAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })),
            ]}
          />
          <Field
            label={t.calendar.booking.notes}
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.currentTarget.value }))}
          />
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}
          <Button
            type="submit"
            loading={submitting}
            disabled={!form.serviceId || !form.clientId || !form.startsAt}
            className="w-full gap-2"
          >
            <Plus size={15} />
            {submitting ? t.calendar.booking.submitting : t.calendar.booking.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
