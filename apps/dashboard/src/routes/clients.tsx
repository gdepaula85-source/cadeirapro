import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Mail, Pencil, Phone, Plus, Search, User } from 'lucide-react';
import type { Client } from '@cadeirapro/shared';
import { api, ApiError } from '../lib/api';
import { formatPhone } from '../lib/format';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { t } from '../strings/pt-BR';

interface ClientFormState {
  id?: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm: ClientFormState = {
  name: '',
  phone: '+55',
  email: '',
  notes: '',
};

export function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.clients.list(search),
  });

  const saveMutation = useMutation({
    mutationFn: (state: ClientFormState) => {
      const input = {
        name: state.name,
        phone: state.phone,
        email: state.email || null,
        notes: state.notes || null,
      };
      return state.id ? api.clients.update(state.id, input) : api.clients.create(input);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'client_phone_exists') {
        setError(t.clients.errors.duplicate);
        return;
      }
      setError(t.clients.errors.generic);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.clients.archive(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['clients'] }),
    onError: () => setError(t.clients.errors.archive),
  });

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  function edit(client: Client) {
    setError(null);
    setForm({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email ?? '',
      notes: client.notes ?? '',
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
            <User size={16} />
            <span className="text-xs uppercase tracking-wider font-medium">{t.common.sprint2}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-1">
            {t.clients.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t.clients.subtitle}</p>
        </div>
        <div className="w-full sm:w-80">
          <Field
            label={t.clients.search}
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium">
            {clientsQuery.isLoading ? t.common.loading : `${clients.length} ${t.clients.title.toLowerCase()}`}
          </div>
          {clients.length === 0 && !clientsQuery.isLoading ? (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">{t.common.empty}</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {clients.map((client) => (
                <article key={client.id} className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-[var(--color-text)] truncate">{client.name}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={13} />
                        {formatPhone(client.phone)}
                      </span>
                      {client.email ? (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={13} />
                          {client.email}
                        </span>
                      ) : null}
                    </div>
                    {client.notes ? (
                      <p className="text-xs text-[var(--color-text-muted)] mt-2 line-clamp-2">
                        {client.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(client)} className="px-3">
                      <Pencil size={14} />
                      <span className="sr-only">{t.common.edit}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(t.clients.archiveConfirm)) archiveMutation.mutate(client.id);
                      }}
                      className="px-3"
                    >
                      <Archive size={14} />
                      <span className="sr-only">{t.common.archive}</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">
              {form.id ? t.clients.editClient : t.clients.newClient}
            </h2>
            {form.id ? (
              <Button variant="ghost" onClick={() => setForm(emptyForm)} className="px-2 py-1">
                {t.common.cancel}
              </Button>
            ) : null}
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field
              label={t.clients.name}
              icon={User}
              required
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.currentTarget.value }))}
            />
            <Field
              label={t.clients.phone}
              icon={Phone}
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.currentTarget.value }))}
            />
            <Field
              label={t.clients.email}
              icon={Mail}
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.currentTarget.value }))}
            />
            <Field
              label={t.clients.notes}
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.currentTarget.value }))}
            />
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
