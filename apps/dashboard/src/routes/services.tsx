import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Clock, Pencil, Plus, Scissors, Sparkles, WalletCards } from 'lucide-react';
import type { Service } from '@cadeirapro/shared';
import { toCents } from '@cadeirapro/shared';
import { api } from '../lib/api';
import { formatBRL } from '../lib/format';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { t } from '../strings/pt-BR';

interface ServiceFormState {
  id?: string;
  name: string;
  description: string;
  durationMinutes: string;
  priceBrl: string;
  sortOrder: string;
  isActive: boolean;
}

const emptyForm: ServiceFormState = {
  name: '',
  description: '',
  durationMinutes: '45',
  priceBrl: '',
  sortOrder: '0',
  isActive: true,
};

export function ServicesPage() {
  const qc = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['services', includeInactive],
    queryFn: () => api.services.list(includeInactive),
  });

  const saveMutation = useMutation({
    mutationFn: async (state: ServiceFormState) => {
      const input = {
        name: state.name,
        description: state.description,
        durationMinutes: Number(state.durationMinutes),
        priceCents: toCents(state.priceBrl),
        sortOrder: Number(state.sortOrder || 0),
        isActive: state.isActive,
      };
      return state.id ? api.services.update(state.id, input) : api.services.create(input);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: () => setError(t.services.errors.generic),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.services.archive(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['services'] }),
    onError: () => setError(t.services.errors.archive),
  });

  const sorted = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const selectedService = sorted.find((service) => service.id === selectedServiceId) ?? null;
  const activeServices = sorted.filter((service) => service.isActive);
  const averageTicket =
    activeServices.length > 0
      ? Math.round(
          activeServices.reduce((sum, service) => sum + service.priceCents, 0) /
            activeServices.length,
        )
      : 0;
  const averageDuration =
    activeServices.length > 0
      ? Math.round(
          activeServices.reduce((sum, service) => sum + service.durationMinutes, 0) /
            activeServices.length,
        )
      : 0;

  function edit(service: Service) {
    setError(null);
    setSelectedServiceId(service.id);
    setForm({
      id: service.id,
      name: service.name,
      description: service.description ?? '',
      durationMinutes: String(service.durationMinutes),
      priceBrl: formatBRL(service.priceCents),
      sortOrder: String(service.sortOrder),
      isActive: service.isActive,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate(form);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Scissors size={16} />
            <span className="text-xs uppercase tracking-wider font-medium">{t.common.sprint2}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-1">
            {t.services.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t.services.subtitle}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-primary)]"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.currentTarget.checked)}
          />
          {t.services.includeInactive}
        </label>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <ServiceMetric
          icon={<Scissors size={16} />}
          label="Serviços ativos"
          value={String(activeServices.length)}
        />
        <ServiceMetric
          icon={<WalletCards size={16} />}
          label="Ticket médio"
          value={activeServices.length ? formatBRL(averageTicket) : t.common.none}
        />
        <ServiceMetric
          icon={<Clock size={16} />}
          label="Duração média"
          value={
            activeServices.length ? `${averageDuration} ${t.common.minutesShort}` : t.common.none
          }
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium">
            {servicesQuery.isLoading
              ? t.common.loading
              : `${sorted.length} ${t.services.title.toLowerCase()}`}
          </div>
          {sorted.length === 0 && !servicesQuery.isLoading ? (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">{t.common.empty}</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {sorted.map((service) => (
                <article
                  key={service.id}
                  className={`p-4 flex flex-col sm:flex-row gap-4 sm:items-center transition ${
                    selectedServiceId === service.id ? 'bg-[var(--color-surface-muted)]' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-[var(--color-text)] truncate">
                        {service.name}
                      </h2>
                      <span
                        className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                          service.isActive
                            ? 'bg-emerald-50 text-[var(--color-success)]'
                            : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        {service.isActive ? t.common.active : t.common.inactive}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                      {service.description || t.common.none}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} />
                        {service.durationMinutes} {t.common.minutesShort}
                      </span>
                      <span className="font-medium text-[var(--color-text)]">
                        {formatBRL(service.priceCents)}
                      </span>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(service)} className="px-3">
                      <Pencil size={14} />
                      <span className="sr-only">{t.common.edit}</span>
                    </Button>
                    {service.isActive ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t.services.archiveConfirm))
                            archiveMutation.mutate(service.id);
                        }}
                        className="px-3"
                      >
                        <Archive size={14} />
                        <span className="sr-only">{t.common.archive}</span>
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">
              {form.id ? t.services.editService : t.services.newService}
            </h2>
            {form.id ? (
              <Button variant="ghost" onClick={() => setForm(emptyForm)} className="px-2 py-1">
                {t.common.cancel}
              </Button>
            ) : null}
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field
              label={t.services.name}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
            <Field
              label={t.services.description}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t.services.durationMinutes}
                type="number"
                min={5}
                step={5}
                required
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.currentTarget.value })}
              />
              <Field
                label={t.services.priceBrl}
                required
                value={form.priceBrl}
                onChange={(e) => setForm({ ...form, priceBrl: e.currentTarget.value })}
              />
            </div>
            <Field
              label={t.services.sortOrder}
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.currentTarget.value })}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
              />
              {t.services.isActive}
            </label>
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <Button type="submit" loading={saveMutation.isPending} className="w-full gap-2">
              <Plus size={15} />
              {form.id ? t.common.save : t.common.create}
            </Button>
          </form>
          <ServiceDetailPanel service={selectedService} />
        </aside>
      </div>
    </div>
  );
}

function ServiceMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function ServiceDetailPanel({ service }: { service: Service | null }) {
  if (!service) {
    return (
      <section className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">
        Selecione um serviço para ver o resumo comercial.
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">{service.name}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {service.isActive ? t.common.active : t.common.inactive} · ordem {service.sortOrder}
          </p>
        </div>
        <span className="rounded bg-[#edf7e9] px-2 py-1 text-xs font-semibold text-[#176527]">
          {formatBRL(service.priceCents)}
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        <div className="rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Tempo: </span>
          <span className="font-medium text-[var(--color-text)]">
            {service.durationMinutes} {t.common.minutesShort}
          </span>
        </div>
        <div className="rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Descrição: </span>
          <span className="font-medium text-[var(--color-text)]">
            {service.description || t.common.none}
          </span>
        </div>
        <div className="flex items-start gap-2 rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
          <Sparkles size={15} className="mt-0.5 shrink-0" />
          <span>Este serviço aparece no widget público quando ativo e atribuído a barbeiros.</span>
        </div>
      </div>
    </section>
  );
}
