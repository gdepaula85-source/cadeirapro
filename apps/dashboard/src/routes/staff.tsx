// Staff (barbeiros + atendentes) CRUD — owner-only writes. Mirrors the
// services / clients pattern: list on the left, edit form on the right.
import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  CalendarDays,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Scissors,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import type {
  CreateStaffInput,
  HoursMap,
  HoursWindow,
  PixKeyType,
  Staff,
  StaffRole,
} from '@cadeirapro/shared';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { Field, SelectField } from '../components/Field';
import { t } from '../strings/pt-BR';

interface StaffFormState {
  id?: string;
  email: string;
  role: StaffRole;
  displayName: string;
  phone: string;
  bio: string;
  pixKey: string;
  pixKeyType: PixKeyType | '';
  commissionPctText: string; // entered as "50" for 50%
  partnerStatus: 'parceiro' | 'employee';
  isActive: boolean;
  assignedServiceIds: string[];
  schedule: HoursMap;
}

const emptyForm: StaffFormState = {
  email: '',
  role: 'barber',
  displayName: '',
  phone: '+55',
  bio: '',
  pixKey: '',
  pixKeyType: '',
  commissionPctText: '',
  partnerStatus: 'parceiro',
  isActive: true,
  assignedServiceIds: [],
  schedule: {},
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function pctTextToFraction(text: string): number | null {
  if (!text.trim()) return null;
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

function fractionToPctText(value: number | null | undefined): string {
  if (value == null) return '';
  return String(Math.round(value * 1000) / 10); // 0.5 → "50"
}

export function StaffPage() {
  const qc = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff', includeInactive],
    queryFn: () => api.staff.list(includeInactive),
  });
  const servicesQuery = useQuery({
    queryKey: ['services', false],
    queryFn: () => api.services.list(false),
  });

  const saveMutation = useMutation({
    mutationFn: async (state: StaffFormState) => {
      const commissionPct = pctTextToFraction(state.commissionPctText);
      if (state.id) {
        return api.staff.update(state.id, {
          displayName: state.displayName,
          phone: state.phone || null,
          email: state.email,
          bio: state.bio || null,
          pixKey: state.pixKey || null,
          pixKeyType: state.pixKey && state.pixKeyType ? state.pixKeyType : null,
          commissionPct,
          partnerStatus: state.partnerStatus,
          isActive: state.isActive,
          assignedServiceIds: state.role === 'barber' ? state.assignedServiceIds : [],
          schedule: state.role === 'barber' ? state.schedule : {},
        });
      }
      const create: CreateStaffInput = {
        email: state.email,
        role: state.role,
        displayName: state.displayName,
        phone: state.phone || null,
        bio: state.bio || null,
        pixKey: state.pixKey || null,
        pixKeyType: state.pixKey && state.pixKeyType ? state.pixKeyType : null,
        commissionPct,
        partnerStatus: state.partnerStatus,
        assignedServiceIds: state.role === 'barber' ? state.assignedServiceIds : [],
        schedule: state.role === 'barber' ? state.schedule : {},
      };
      return api.staff.create(create);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'staff_email_in_use') {
        setError(t.staff.errors.duplicate);
        return;
      }
      setError(t.staff.errors.generic);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.staff.archive(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['staff'] }),
    onError: () => setError(t.staff.errors.archive),
  });

  const sorted = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);

  function edit(member: Staff) {
    setError(null);
    setForm({
      id: member.id,
      email: member.email ?? '',
      role: member.role === 'staff' ? 'staff' : 'barber',
      displayName: member.displayName,
      phone: member.phone ?? '+55',
      bio: member.bio ?? '',
      pixKey: member.pixKey ?? '',
      pixKeyType: (member.pixKeyType ?? '') as PixKeyType | '',
      commissionPctText: fractionToPctText(member.commissionPct),
      partnerStatus: member.partnerStatus === 'employee' ? 'employee' : 'parceiro',
      isActive: member.isActive,
      assignedServiceIds: member.assignedServiceIds,
      schedule: member.schedule,
    });
  }

  function serviceName(serviceId: string): string {
    return servicesQuery.data?.find((service) => service.id === serviceId)?.name ?? serviceId;
  }

  function toggleService(serviceId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      assignedServiceIds: checked
        ? [...new Set([...current.assignedServiceIds, serviceId])]
        : current.assignedServiceIds.filter((id) => id !== serviceId),
    }));
  }

  function setScheduleDay(day: keyof HoursMap, enabled: boolean) {
    setForm((current) => {
      const next = { ...current.schedule };
      if (enabled) next[day] = next[day]?.length ? next[day] : [{ open: '09:00', close: '18:00' }];
      else delete next[day];
      return { ...current, schedule: next };
    });
  }

  function setScheduleWindow(day: keyof HoursMap, field: keyof HoursWindow, value: string) {
    setForm((current) => {
      const currentWindow = current.schedule[day]?.[0] ?? { open: '09:00', close: '18:00' };
      return {
        ...current,
        schedule: {
          ...current.schedule,
          [day]: [{ ...currentWindow, [field]: value }],
        },
      };
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
            <Users size={16} />
            <span className="text-xs uppercase tracking-wider font-medium">{t.common.sprint2}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-1">
            {t.staff.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
            {t.staff.subtitle}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-primary)]"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.currentTarget.checked)}
          />
          {t.staff.includeInactive}
        </label>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 items-start">
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium">
            {staffQuery.isLoading
              ? t.common.loading
              : `${sorted.length} ${t.staff.title.toLowerCase()}`}
          </div>
          {sorted.length === 0 && !staffQuery.isLoading ? (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">{t.common.empty}</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {sorted.map((member) => (
                <article
                  key={member.id}
                  className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-[var(--color-text)] truncate">
                        {member.displayName}
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                        {member.role === 'staff' ? <UserCheck size={11} /> : <Scissors size={11} />}
                        {member.role === 'staff' ? t.staff.roles.staff : t.staff.roles.barber}
                      </span>
                      {!member.isActive ? (
                        <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                          {t.common.inactive}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[var(--color-text-muted)]">
                      {member.email ? (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} />
                          {member.email}
                        </span>
                      ) : null}
                      {member.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} />
                          {member.phone}
                        </span>
                      ) : null}
                      {member.commissionPct != null ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium text-[var(--color-text)]">
                            {fractionToPctText(member.commissionPct)}%
                          </span>
                          <span>comissão</span>
                        </span>
                      ) : null}
                    </div>
                    {member.role === 'barber' ? (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        <span className="font-medium text-[var(--color-text)]">
                          {member.assignedServiceIds.length}
                        </span>{' '}
                        {t.staff.assignedServicesCount}
                        {member.assignedServiceIds.length > 0 ? (
                          <span> · {member.assignedServiceIds.slice(0, 3).map(serviceName).join(', ')}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {member.pixKey ? (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-[var(--color-text-muted)]">
                        <KeyRound size={12} />
                        <code className="text-[var(--color-text)] font-mono">{member.pixKey}</code>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(member)} className="px-3">
                      <Pencil size={14} />
                      <span className="sr-only">{t.common.edit}</span>
                    </Button>
                    {member.isActive ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t.staff.archiveConfirm))
                            archiveMutation.mutate(member.id);
                        }}
                        className="px-3"
                      >
                        <UserX size={14} />
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
              {form.id ? t.staff.editMember : t.staff.newMember}
            </h2>
            {form.id ? (
              <Button variant="ghost" onClick={() => setForm(emptyForm)} className="px-2 py-1">
                {t.common.cancel}
              </Button>
            ) : null}
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <SelectField
              label={t.staff.role}
              value={form.role}
              disabled={!!form.id}
              onChange={(e) => setForm({ ...form, role: e.currentTarget.value as StaffRole })}
              options={[
                { value: 'barber', label: t.staff.roles.barber },
                { value: 'staff', label: t.staff.roles.staff },
              ]}
            />
            <Field
              label={t.staff.name}
              required
              minLength={2}
              maxLength={80}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.currentTarget.value })}
            />
            <Field
              label={t.staff.email}
              icon={AtSign}
              type="email"
              required
              helper={form.id ? undefined : t.staff.emailHelp}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
            />
            <Field
              label={t.staff.phone}
              icon={Phone}
              type="tel"
              placeholder="+5511999998888"
              helper={t.staff.phoneHelp}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
            />
            <SelectField
              label={t.staff.partnerStatus}
              value={form.partnerStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  partnerStatus: e.currentTarget.value as 'parceiro' | 'employee',
                })
              }
              options={[
                { value: 'parceiro', label: t.staff.partnerStatusOptions.parceiro },
                { value: 'employee', label: t.staff.partnerStatusOptions.employee },
              ]}
            />
            <Field
              label={t.staff.commissionPct}
              type="number"
              min={0}
              max={100}
              step={1}
              helper={t.staff.commissionPctHelp}
              value={form.commissionPctText}
              onChange={(e) => setForm({ ...form, commissionPctText: e.currentTarget.value })}
            />
            <Field
              label={t.staff.pixKey}
              icon={KeyRound}
              value={form.pixKey}
              onChange={(e) => setForm({ ...form, pixKey: e.currentTarget.value })}
            />
            <SelectField
              label={t.staff.pixKeyType}
              value={form.pixKeyType}
              onChange={(e) =>
                setForm({ ...form, pixKeyType: e.currentTarget.value as PixKeyType | '' })
              }
              options={[
                { value: '', label: '—' },
                { value: 'cpf', label: t.signup.pixTypes.cpf },
                { value: 'cnpj', label: t.signup.pixTypes.cnpj },
                { value: 'email', label: t.signup.pixTypes.email },
                { value: 'phone', label: t.signup.pixTypes.phone },
                { value: 'random', label: t.signup.pixTypes.random },
              ]}
            />
            {form.id ? (
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-primary)]"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
                />
                {t.staff.isActive}
              </label>
            ) : null}
            {form.role === 'barber' ? (
              <section className="space-y-3 rounded-md border border-[var(--color-border)] p-3">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t.staff.assignedServices}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {t.staff.assignedServicesHelp}
                  </p>
                </div>
                {servicesQuery.isLoading ? (
                  <p className="text-xs text-[var(--color-text-muted)]">{t.common.loading}</p>
                ) : servicesQuery.data?.length ? (
                  <div className="grid grid-cols-1 gap-2">
                    {servicesQuery.data.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-2 text-sm text-[var(--color-text)]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-primary)]"
                          checked={form.assignedServiceIds.includes(service.id)}
                          onChange={(e) => toggleService(service.id, e.currentTarget.checked)}
                        />
                        <span className="truncate">{service.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t.staff.noServicesAvailable}
                  </p>
                )}
              </section>
            ) : null}
            {form.role === 'barber' ? (
              <section className="space-y-3 rounded-md border border-[var(--color-border)] p-3">
                <div className="flex items-start gap-2">
                  <CalendarDays size={15} className="mt-0.5 text-[var(--color-text-muted)]" />
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text)]">
                      {t.staff.schedule}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {t.staff.scheduleHelp}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {DAY_KEYS.map((day) => {
                    const enabled = !!form.schedule[day]?.length;
                    const window = form.schedule[day]?.[0] ?? { open: '09:00', close: '18:00' };
                    return (
                      <div key={day} className="grid grid-cols-[1fr_88px_88px] gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--color-primary)]"
                            checked={enabled}
                            onChange={(e) => setScheduleDay(day, e.currentTarget.checked)}
                          />
                          {t.settings.hours.days[day]}
                        </label>
                        <input
                          type="time"
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm disabled:opacity-50"
                          value={window.open}
                          disabled={!enabled}
                          onChange={(e) => setScheduleWindow(day, 'open', e.currentTarget.value)}
                        />
                        <input
                          type="time"
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm disabled:opacity-50"
                          value={window.close}
                          disabled={!enabled}
                          onChange={(e) => setScheduleWindow(day, 'close', e.currentTarget.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
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
