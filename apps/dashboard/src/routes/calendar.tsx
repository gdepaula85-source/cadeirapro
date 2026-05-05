// Day-view calendar. Single barber per view, 08:00-20:00 grid (1 minute = 1px),
// bookings rendered as positioned blocks. "Novo agendamento" opens a modal that
// pulls available slots from /v1/availability for the selected (barber, service,
// date) combination.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
  UserX,
} from 'lucide-react';
import type {
  AvailabilitySlot,
  Booking,
  BookingStatus,
  Client,
  ScheduleBlock,
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
  id: string | null;
  barberId: string;
  serviceId: string;
  clientId: string;
  startsAt: string; // ISO UTC
  startsAtLocal: string;
  status: BookingStatus;
  notes: string;
}

const emptyBookingForm: BookingFormState = {
  id: null,
  barberId: '',
  serviceId: '',
  clientId: '',
  startsAt: '',
  startsAtLocal: '',
  status: 'confirmed',
  notes: '',
};

interface BlockFormState {
  barberId: string;
  startsAtLocal: string;
  endsAtLocal: string;
  reason: string;
}

function defaultBlockForm(ymd: string, barberId: string): BlockFormState {
  return {
    barberId,
    startsAtLocal: `${ymd}T12:00`,
    endsAtLocal: `${ymd}T13:00`,
    reason: '',
  };
}

function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

function isoToLocalInput(value: string): string {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function CalendarPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(ymdToday());
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingFormState>(emptyBookingForm);
  const [blockFormOpen, setBlockFormOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockFormState>(() =>
    defaultBlockForm(ymdToday(), ''),
  );
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

  const blocksQuery = useQuery({
    queryKey: ['schedule-blocks', date, selectedBarberId],
    queryFn: () =>
      api.scheduleBlocks.list({
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
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [bookingsQuery.data, date, statusFilter]);

  const dayBookingsUnfiltered = useMemo(() => {
    const all = bookingsQuery.data ?? [];
    return all
      .filter((b) => b.status !== 'cancelled')
      .filter((b) => {
        const local = new Date(b.startsAt);
        const y = local.getFullYear();
        const m = String(local.getMonth() + 1).padStart(2, '0');
        const d = String(local.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === date;
      });
  }, [bookingsQuery.data, date]);

  const availabilityQuery = useQuery({
    queryKey: [
      'availability',
      bookingForm.barberId || selectedBarberId,
      bookingForm.serviceId,
      date,
    ],
    queryFn: () =>
      api.availability.list({
        barberId: bookingForm.barberId || selectedBarberId,
        serviceId: bookingForm.serviceId,
        date,
      }),
    enabled:
      bookingFormOpen &&
      !bookingForm.id &&
      !!(bookingForm.barberId || selectedBarberId) &&
      !!bookingForm.serviceId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.bookings.create({
        clientId: bookingForm.clientId,
        barberId: bookingForm.barberId || selectedBarberId,
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

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!bookingForm.id) throw new Error('booking_id_missing');
      return api.bookings.update(bookingForm.id, {
        clientId: bookingForm.clientId,
        barberId: bookingForm.barberId,
        serviceId: bookingForm.serviceId,
        startsAt: localInputToIso(bookingForm.startsAtLocal),
        status: bookingForm.status,
        notes: bookingForm.notes || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['bookings'] }),
        qc.invalidateQueries({ queryKey: ['availability'] }),
      ]);
      setBookingFormOpen(false);
      setBookingForm(emptyBookingForm);
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'booking_overlap') {
        setError(t.calendar.errors.overlap);
        return;
      }
      if (err instanceof ApiError && err.code === 'barber_not_assigned_to_service') {
        setError(t.calendar.errors.barberService);
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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'completed' | 'no_show' }) =>
      api.bookings.update(id, { status }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['bookings'] }),
    onError: () => setError(t.calendar.errors.status),
  });

  const createBlockMutation = useMutation({
    mutationFn: () =>
      api.scheduleBlocks.create({
        barberId: blockForm.barberId ? blockForm.barberId : null,
        startsAt: localInputToIso(blockForm.startsAtLocal),
        endsAt: localInputToIso(blockForm.endsAtLocal),
        reason: blockForm.reason || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['schedule-blocks'] }),
        qc.invalidateQueries({ queryKey: ['availability'] }),
      ]);
      setBlockFormOpen(false);
      setError(null);
    },
    onError: () => setError(t.calendar.blocks.errors.generic),
  });

  const removeBlockMutation = useMutation({
    mutationFn: (id: string) => api.scheduleBlocks.remove(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['schedule-blocks'] }),
        qc.invalidateQueries({ queryKey: ['availability'] }),
      ]);
    },
    onError: () => setError(t.calendar.blocks.errors.remove),
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
    setBookingForm({ ...emptyBookingForm, barberId: selectedBarberId });
    setBookingFormOpen(true);
  }

  function openEditBooking(booking: Booking) {
    setError(null);
    setBookingForm({
      id: booking.id,
      barberId: booking.barberId,
      serviceId: booking.serviceId,
      clientId: booking.clientId,
      startsAt: booking.startsAt,
      startsAtLocal: isoToLocalInput(booking.startsAt),
      status: booking.status,
      notes: booking.notes ?? '',
    });
    setBookingFormOpen(true);
  }

  function openNewBlock() {
    setError(null);
    setBlockForm(defaultBlockForm(date, selectedBarberId));
    setBlockFormOpen(true);
  }

  function onBookingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookingForm.serviceId || !bookingForm.clientId) return;
    if (bookingForm.id) {
      if (!bookingForm.barberId || !bookingForm.startsAtLocal) return;
      updateMutation.mutate();
      return;
    }
    if (!bookingForm.startsAt || !(bookingForm.barberId || selectedBarberId)) return;
    createMutation.mutate();
  }

  function onBlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!blockForm.startsAtLocal || !blockForm.endsAtLocal) return;
    createBlockMutation.mutate();
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
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={openNewBooking}
            disabled={dependenciesMissing || !selectedBarberId}
            className="gap-2"
          >
            <Plus size={15} />
            {t.calendar.newBooking}
          </Button>
          <Button
            variant="secondary"
            onClick={openNewBlock}
            disabled={!selectedBarberId}
            className="gap-2"
          >
            <Clock size={15} />
            {t.calendar.blocks.newBlock}
          </Button>
        </div>
      </div>

      <CalendarSummary
        bookings={dayBookingsUnfiltered}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

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
          onEdit={openEditBooking}
          onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          onCancel={(id) => {
            if (window.confirm(t.calendar.cancelConfirm)) cancelMutation.mutate(id);
          }}
        />
      )}

      <ScheduleBlocksPanel
        blocks={blocksQuery.data ?? []}
        loading={blocksQuery.isLoading}
        selectedBarberId={selectedBarberId}
        onRemove={(id) => {
          if (window.confirm(t.calendar.blocks.removeConfirm)) removeBlockMutation.mutate(id);
        }}
      />

      {bookingFormOpen ? (
        <BookingFormModal
          form={bookingForm}
          setForm={setBookingForm}
          onClose={() => setBookingFormOpen(false)}
          onSubmit={onBookingSubmit}
          submitting={createMutation.isPending || updateMutation.isPending}
          error={error}
          barbers={barbers}
          services={activeServices}
          clients={clientOptions}
          slots={availabilityQuery.data ?? []}
          slotsLoading={availabilityQuery.isLoading}
        />
      ) : null}
      {blockFormOpen ? (
        <ScheduleBlockModal
          form={blockForm}
          setForm={setBlockForm}
          onClose={() => setBlockFormOpen(false)}
          onSubmit={onBlockSubmit}
          submitting={createBlockMutation.isPending}
          barbers={barbers}
          error={error}
        />
      ) : null}
    </div>
  );
}

function ScheduleBlocksPanel({
  blocks,
  loading,
  selectedBarberId,
  onRemove,
}: {
  blocks: ScheduleBlock[];
  loading: boolean;
  selectedBarberId: string;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock size={15} />
          {t.calendar.blocks.title}
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {loading ? t.common.loading : `${blocks.length} ${t.calendar.blocks.countLabel}`}
        </span>
      </div>
      {blocks.length === 0 ? (
        <div className="px-4 py-5 text-sm text-[var(--color-text-muted)]">
          {selectedBarberId ? t.calendar.blocks.empty : t.calendar.selectBarber}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {blocks.map((block) => (
            <div key={block.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--color-text)]">
                  {new Date(block.startsAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {new Date(block.endsAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] truncate">
                  {block.barberId
                    ? (block.barberName ?? t.calendar.barber)
                    : t.calendar.blocks.shopWide}
                  {block.reason ? ` · ${block.reason}` : ''}
                </div>
              </div>
              <button
                onClick={() => onRemove(block.id)}
                className="shrink-0 p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                aria-label={t.calendar.blocks.remove}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CalendarSummary({
  bookings,
  statusFilter,
  onStatusFilterChange,
}: {
  bookings: Booking[];
  statusFilter: BookingStatus | 'all';
  onStatusFilterChange: (status: BookingStatus | 'all') => void;
}) {
  const revenue = bookings
    .filter((booking) => booking.status === 'completed')
    .reduce((sum, booking) => sum + (booking.servicePriceCents ?? 0), 0);
  const upcoming = bookings.filter(
    (booking) => booking.status === 'pending' || booking.status === 'confirmed',
  ).length;
  const completed = bookings.filter((booking) => booking.status === 'completed').length;
  const noShow = bookings.filter((booking) => booking.status === 'no_show').length;

  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label={t.calendar.summary.total} value={String(bookings.length)} />
        <SummaryCard label={t.calendar.summary.upcoming} value={String(upcoming)} />
        <SummaryCard label={t.calendar.summary.completed} value={String(completed)} />
        <SummaryCard label={t.calendar.summary.revenue} value={formatBRL(revenue)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'confirmed', 'completed', 'no_show'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusFilterChange(status)}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
              statusFilter === status
                ? 'border-[var(--color-primary)] bg-[var(--color-surface-muted)] text-[var(--color-text)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {status === 'all' ? t.calendar.summary.all : t.calendar.status[status]}
          </button>
        ))}
        {noShow > 0 ? (
          <span className="rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
            {noShow} {t.calendar.status.no_show}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function DayGrid({
  bookings,
  loading,
  onEdit,
  onStatusChange,
  onCancel,
}: {
  bookings: Booking[];
  loading: boolean;
  onEdit: (booking: Booking) => void;
  onStatusChange: (id: string, status: 'completed' | 'no_show') => void;
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
                    {b.status === 'pending' || b.status === 'confirmed' ? (
                      <div className="shrink-0 -mr-1 -mt-1 flex gap-0.5">
                        <button
                          onClick={() => onEdit(b)}
                          className="p-1 rounded hover:bg-black/5"
                          aria-label={t.common.edit}
                          title={t.common.edit}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onStatusChange(b.id, 'completed')}
                          className="p-1 rounded hover:bg-black/5"
                          aria-label={t.calendar.actions.complete}
                          title={t.calendar.actions.complete}
                        >
                          <CheckCircle2 size={12} />
                        </button>
                        <button
                          onClick={() => onStatusChange(b.id, 'no_show')}
                          className="p-1 rounded hover:bg-black/5"
                          aria-label={t.calendar.actions.noShow}
                          title={t.calendar.actions.noShow}
                        >
                          <UserX size={12} />
                        </button>
                        <button
                          onClick={() => onCancel(b.id)}
                          className="p-1 rounded hover:bg-black/5"
                          aria-label={t.calendar.cancelBooking}
                          title={t.calendar.cancelBooking}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : null}
                    {b.status === 'completed' || b.status === 'no_show' ? (
                      <button
                        onClick={() => onEdit(b)}
                        className="shrink-0 -mr-1 -mt-1 p-1 rounded hover:bg-black/5"
                        aria-label={t.common.edit}
                        title={t.common.edit}
                      >
                        <Pencil size={12} />
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

function ScheduleBlockModal({
  form,
  setForm,
  onClose,
  onSubmit,
  submitting,
  barbers,
  error,
}: {
  form: BlockFormState;
  setForm: (updater: BlockFormState | ((s: BlockFormState) => BlockFormState)) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  barbers: Staff[];
  error: string | null;
}) {
  const invalidRange =
    !!form.startsAtLocal &&
    !!form.endsAtLocal &&
    new Date(form.endsAtLocal).getTime() <= new Date(form.startsAtLocal).getTime();

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col shadow-lg">
        <header className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-base font-semibold">{t.calendar.blocks.newBlock}</h2>
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
            label={t.calendar.blocks.scope}
            value={form.barberId}
            onChange={(e) => setForm({ ...form, barberId: e.currentTarget.value })}
            options={[
              { value: '', label: t.calendar.blocks.shopWide },
              ...barbers.map((b) => ({ value: b.id, label: b.displayName })),
            ]}
          />
          <Field
            label={t.calendar.blocks.startsAt}
            type="datetime-local"
            value={form.startsAtLocal}
            onChange={(e) => setForm({ ...form, startsAtLocal: e.currentTarget.value })}
          />
          <Field
            label={t.calendar.blocks.endsAt}
            type="datetime-local"
            value={form.endsAtLocal}
            onChange={(e) => setForm({ ...form, endsAtLocal: e.currentTarget.value })}
          />
          <Field
            label={t.calendar.blocks.reason}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.currentTarget.value })}
          />
          {invalidRange ? (
            <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{t.calendar.blocks.errors.range}</span>
            </div>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}
          <Button
            type="submit"
            loading={submitting}
            disabled={!form.startsAtLocal || !form.endsAtLocal || invalidRange}
            className="w-full gap-2"
          >
            <Clock size={15} />
            {submitting ? t.calendar.booking.submitting : t.calendar.blocks.submit}
          </Button>
        </form>
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
  barbers,
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
  barbers: Staff[];
  services: Service[];
  clients: Client[];
  slots: AvailabilitySlot[];
  slotsLoading: boolean;
}) {
  const isEditing = !!form.id;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col shadow-lg">
        <header className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {isEditing ? t.calendar.editBooking : t.calendar.newBooking}
          </h2>
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
            label={t.calendar.booking.barber}
            value={form.barberId}
            onChange={(e) => setForm({ ...form, barberId: e.currentTarget.value, startsAt: '' })}
            options={[
              { value: '', label: t.calendar.selectBarber },
              ...barbers.map((b) => ({ value: b.id, label: b.displayName })),
            ]}
          />
          <SelectField
            label={t.calendar.booking.service}
            value={form.serviceId}
            onChange={(e) =>
              setForm({
                ...form,
                serviceId: e.currentTarget.value,
                startsAt: isEditing ? form.startsAt : '',
              })
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
            onChange={(e) => setForm({ ...form, clientId: e.currentTarget.value })}
            options={[
              { value: '', label: t.calendar.booking.pickClient },
              ...clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` })),
            ]}
          />
          {isEditing ? (
            <>
              <Field
                label={t.calendar.booking.startsAt}
                type="datetime-local"
                value={form.startsAtLocal}
                onChange={(e) => setForm({ ...form, startsAtLocal: e.currentTarget.value })}
              />
              <SelectField
                label={t.calendar.booking.status}
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.currentTarget.value as BookingStatus })
                }
                options={[
                  { value: 'pending', label: t.calendar.status.pending },
                  { value: 'confirmed', label: t.calendar.status.confirmed },
                  { value: 'completed', label: t.calendar.status.completed },
                  { value: 'no_show', label: t.calendar.status.no_show },
                  { value: 'cancelled', label: t.calendar.status.cancelled },
                ]}
              />
            </>
          ) : (
            <SelectField
              label={t.calendar.booking.slot}
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.currentTarget.value })}
              disabled={!form.serviceId || !form.barberId || slotsLoading}
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
          )}
          <Field
            label={t.calendar.booking.notes}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
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
            disabled={
              !form.barberId ||
              !form.serviceId ||
              !form.clientId ||
              (isEditing ? !form.startsAtLocal : !form.startsAt)
            }
            className="w-full gap-2"
          >
            {isEditing ? <Pencil size={15} /> : <Plus size={15} />}
            {submitting
              ? t.calendar.booking.submitting
              : isEditing
                ? t.calendar.booking.update
                : t.calendar.booking.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
