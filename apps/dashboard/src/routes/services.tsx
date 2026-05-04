import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Clock, Pencil, Plus, Scissors } from 'lucide-react';
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

  const sorted = useMemo(
    () => servicesQuery.data ?? [],
    [servicesQuery.data],
  );

  function edit(service: Service) {
    setError(null);
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium">
            {servicesQuery.isLoading ? t.common.loading : `${sorted.length} ${t.services.title.toLowerCase()}`}
          </div>
          {sorted.length === 0 && !servicesQuery.isLoading ? (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">{t.common.empty}</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {sorted.map((service) => (
                <article key={service.id} className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-[var(--color-text)] truncate">{service.name}</h2>
                      <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                        service.isActive
                          ? 'bg-emerald-50 text-[var(--color-success)]'
                          : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                      }`}>
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
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(service)} className="px-3">
                      <Pencil size={14} />
                      <span className="sr-only">{t.common.edit}</span>
                    </Button>
                    {service.isActive ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t.services.archiveConfirm)) archiveMutation.mutate(service.id);
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
              onChange={(e) => setForm((s) => ({ ...s, name: e.currentTarget.value }))}
            />
            <Field
              label={t.services.description}
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.currentTarget.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t.services.durationMinutes}
                type="number"
                min={5}
                step={5}
                required
                value={form.durationMinutes}
                onChange={(e) => setForm((s) => ({ ...s, durationMinutes: e.currentTarget.value }))}
              />
              <Field
                label={t.services.priceBrl}
                required
                value={form.priceBrl}
                onChange={(e) => setForm((s) => ({ ...s, priceBrl: e.currentTarget.value }))}
              />
            </div>
            <Field
              label={t.services.sortOrder}
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((s) => ({ ...s, sortOrder: e.currentTarget.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={form.isActive}
                onChange={(e) => setForm((s) => ({ ...s, isActive: e.currentTarget.checked }))}
              />
              {t.services.isActive}
            </label>
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <Button type="submit" loading={saveMutation.isPending} className="w-full gap-2">
              <Plus size={15} />
              {form.id ? t.common.save : t.common.create}
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
