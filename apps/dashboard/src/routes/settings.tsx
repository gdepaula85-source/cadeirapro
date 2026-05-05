// Settings page — three tabs: Loja (shop info), Horário (per-day windows),
// Marca (theme colors + logo URL). Submits a single PATCH /v1/organization.
// Owner-only writes are enforced server-side; the UI shows the form to
// anyone in the org.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  FileDigit,
  KeyRound,
  Phone,
  Palette,
  Settings as SettingsIcon,
  Store,
} from 'lucide-react';
import type {
  HoursMap,
  HoursWindow,
  Organization,
  PixKeyType,
  UpdateOrganizationInput,
} from '@cadeirapro/shared';
import { validatePixKeyFormat } from '@cadeirapro/shared';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { Field, SelectField } from '../components/Field';
import { PRESETS, DEFAULT_THEME_ID, findPreset } from '../lib/themes';
import { t } from '../strings/pt-BR';

type TabKey = 'shop' | 'hours' | 'branding';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface DayState {
  enabled: boolean;
  open: string;
  close: string;
}

interface HoursState {
  mon: DayState;
  tue: DayState;
  wed: DayState;
  thu: DayState;
  fri: DayState;
  sat: DayState;
  sun: DayState;
}

interface ShopFormState {
  shopName: string;
  legalName: string;
  document: string; // raw digits, will be split into cnpj/cpf on submit
  primaryPixKey: string;
  primaryPixKeyType: PixKeyType;
  whatsappPhone: string;
  timezone: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

interface BrandingFormState {
  themeId: string;
  logoUrl: string;
  coverUrl: string;
}

const DEFAULT_DAY: DayState = { enabled: false, open: '09:00', close: '18:00' };

function hoursMapToState(hours: HoursMap | null | undefined): HoursState {
  const out: Partial<HoursState> = {};
  for (const day of DAY_ORDER) {
    const wins = hours?.[day];
    if (wins && wins.length > 0) {
      const first = wins[0]!;
      out[day] = { enabled: true, open: first.open, close: first.close };
    } else {
      out[day] = { ...DEFAULT_DAY };
    }
  }
  return out as HoursState;
}

function hoursStateToMap(state: HoursState): HoursMap {
  const out: HoursMap = {};
  for (const day of DAY_ORDER) {
    const d = state[day];
    if (d.enabled && d.open && d.close && d.open < d.close) {
      out[day] = [{ open: d.open, close: d.close }];
    }
  }
  return out;
}

function pixKeyError(shop: ShopFormState): string | undefined {
  const key = shop.primaryPixKey.trim();
  if (!key) return undefined;
  return validatePixKeyFormat(key, shop.primaryPixKeyType)
    ? undefined
    : t.settings.errors.pixFormat;
}

function shopFromOrg(org: Organization): ShopFormState {
  const address = (org.address ?? {}) as Record<string, string | null | undefined>;
  return {
    shopName: org.name,
    legalName: org.legalName ?? '',
    document: org.cnpj ?? org.cpf ?? '',
    primaryPixKey: org.primaryPixKey,
    primaryPixKeyType: org.primaryPixKeyType,
    whatsappPhone: org.whatsappPhone ?? '',
    timezone: org.timezone ?? 'America/Sao_Paulo',
    street: address.street ?? '',
    number: address.number ?? '',
    complement: address.complement ?? '',
    neighborhood: address.neighborhood ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zip: address.zip ?? '',
  };
}

function brandingFromOrg(org: Organization): BrandingFormState {
  return {
    themeId: org.themeId || DEFAULT_THEME_ID,
    logoUrl: org.logoUrl ?? '',
    coverUrl: org.coverUrl ?? '',
  };
}

export function SettingsPage() {
  const qc = useQueryClient();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => api.me() });
  const org = meQuery.data?.organization;

  const [tab, setTab] = useState<TabKey>('shop');
  const [shop, setShop] = useState<ShopFormState | null>(null);
  const [hours, setHours] = useState<HoursState | null>(null);
  const [branding, setBranding] = useState<BrandingFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  // Hydrate form state once /v1/me lands.
  useEffect(() => {
    if (!org) return;
    const nextShop = shopFromOrg(org);
    const nextHours = hoursMapToState(org.hours as HoursMap | null | undefined);
    const nextBranding = brandingFromOrg(org);
    setShop(nextShop);
    setHours(nextHours);
    setBranding(nextBranding);
    setInitialSnapshot(JSON.stringify({ shop: nextShop, hours: nextHours, branding: nextBranding }));
  }, [org?.id, org?.updatedAt]);

  const dirty = useMemo(() => {
    if (!shop || !hours || !branding || !initialSnapshot) return false;
    return JSON.stringify({ shop, hours, branding }) !== initialSnapshot;
  }, [shop, hours, branding, initialSnapshot]);

  // Native browser warning on close/refresh while dirty.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!shop || !hours || !branding) {
        return Promise.reject(new Error('settings_not_ready'));
      }
      const digits = shop.document.replace(/\D/g, '');
      // themeConfig kept in sync with the selected preset so any consumer
      // still reading themeConfig.primary/accent (e.g. the dashboard's
      // ThemeApplier) gets sensible values without picking a theme system.
      const preset = findPreset(branding.themeId);
      const patch: UpdateOrganizationInput = {
        name: shop.shopName.trim(),
        legalName: shop.legalName.trim() || null,
        cnpj: digits.length === 14 ? digits : null,
        cpf: digits.length === 11 ? digits : null,
        primaryPixKey: shop.primaryPixKey.trim(),
        primaryPixKeyType: shop.primaryPixKeyType,
        whatsappPhone: shop.whatsappPhone.trim() || null,
        timezone: shop.timezone,
        address: cleanAddress(shop),
        logoUrl: branding.logoUrl.trim() || null,
        coverUrl: branding.coverUrl.trim() || null,
        hours: hoursStateToMap(hours),
        themeId: branding.themeId,
        themeConfig: {
          primary: preset.palette.primary,
          accent: preset.palette.accent,
        },
      };
      return api.organization.update(patch);
    },
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ['me'] });
      // Auto-clear the saved badge after a couple seconds.
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setSaved(false);
      if (err instanceof ApiError && err.code === 'validation_failed') {
        setError(t.settings.errors.pixFormat);
        return;
      }
      setError(t.settings.errors.generic);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (shop) {
      const pixErr = pixKeyError(shop);
      if (pixErr) {
        setError(pixErr);
        setTab('shop');
        return;
      }
    }
    saveMutation.mutate();
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      active
        ? 'bg-[var(--color-surface-muted)] text-[var(--color-text)]'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
    }`;

  if (meQuery.isError) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>{t.settings.errors.generic}</strong>
            <div className="text-xs mt-1 opacity-80">
              {(meQuery.error as Error)?.message ?? 'unknown'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!shop || !hours || !branding) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-sm text-[var(--color-text-muted)]">
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <SettingsIcon size={16} />
          <span className="text-xs uppercase tracking-wider font-medium">{t.common.sprint2}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-1">
          {t.settings.title}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
          {t.settings.subtitle}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <SettingsMetric label="Loja" value={shop.shopName || t.common.none} />
        <SettingsMetric
          label="Dias abertos"
          value={String(Object.values(hours).filter((day) => day.enabled).length)}
        />
        <SettingsMetric label="Cidade" value={shop.city || t.common.none} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
            <button
              type="button"
              onClick={() => setTab('shop')}
              className={tabClass(tab === 'shop')}
            >
              {t.settings.tabs.shop}
            </button>
            <button
              type="button"
              onClick={() => setTab('hours')}
              className={tabClass(tab === 'hours')}
            >
              {t.settings.tabs.hours}
            </button>
            <button
              type="button"
              onClick={() => setTab('branding')}
              className={tabClass(tab === 'branding')}
            >
              {t.settings.tabs.branding}
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {tab === 'shop' ? (
              <ShopTab shop={shop} setShop={setShop} />
            ) : tab === 'hours' ? (
              <HoursTab hours={hours} setHours={setHours} />
            ) : (
              <BrandingTab branding={branding} setBranding={setBranding} />
            )}

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}
            {saved ? (
              <div className="flex items-start gap-2 rounded-md border border-[var(--color-success)]/40 bg-emerald-50 px-3 py-2 text-sm text-[var(--color-success)]">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>{t.settings.saved}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              {dirty && !saved ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
                    aria-hidden
                  />
                  {t.settings.unsavedChanges}
                </span>
              ) : (
                <span />
              )}
              <Button type="submit" loading={saveMutation.isPending} disabled={!dirty}>
                {saveMutation.isPending ? t.settings.saving : t.settings.save}
              </Button>
            </div>
          </form>
        </div>
        <SettingsPreview shop={shop} branding={branding} hours={hours} />
      </div>
    </div>
  );
}

function SettingsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function cleanAddress(shop: ShopFormState) {
  const address = {
    street: shop.street.trim() || null,
    number: shop.number.trim() || null,
    complement: shop.complement.trim() || null,
    neighborhood: shop.neighborhood.trim() || null,
    city: shop.city.trim() || null,
    state: shop.state.trim().toUpperCase() || null,
    zip: shop.zip.replace(/\D/g, '') || null,
  };
  return Object.values(address).some(Boolean) ? address : null;
}

function SettingsPreview({
  shop,
  branding,
  hours,
}: {
  shop: ShopFormState;
  branding: BrandingFormState;
  hours: HoursState;
}) {
  const nextOpenDay = DAY_ORDER.find((day) => hours[day].enabled);

  return (
    <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        <Palette size={16} />
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Prévia da loja</h2>
      </div>
      <ThemePreview branding={branding} shop={shop} />
      <div className="mt-4 space-y-2 text-sm text-[var(--color-text-muted)]">
        <p>
          Fuso horário:{' '}
          <span className="font-medium text-[var(--color-text)]">{shop.timezone}</span>
        </p>
        <p>
          Primeiro dia aberto:{' '}
          <span className="font-medium text-[var(--color-text)]">
            {nextOpenDay ? t.settings.hours.days[nextOpenDay] : t.settings.hours.closed}
          </span>
        </p>
        <p>
          Logo:{' '}
          <span className="font-medium text-[var(--color-text)]">
            {branding.logoUrl ? 'configurado' : t.common.none}
          </span>
        </p>
        <p>
          Capa:{' '}
          <span className="font-medium text-[var(--color-text)]">
            {branding.coverUrl ? 'configurada' : t.common.none}
          </span>
        </p>
      </div>
    </aside>
  );
}

function ShopTab({ shop, setShop }: { shop: ShopFormState; setShop: (v: ShopFormState) => void }) {
  const docDigits = useMemo(() => shop.document.replace(/\D/g, ''), [shop.document]);
  const pixErr = pixKeyError(shop);
  const docHelp =
    docDigits.length === 14
      ? t.settings.shop.cnpjHelp
      : docDigits.length === 11
        ? t.settings.shop.cpfHelp
        : `${t.settings.shop.cnpjHelp} ${t.settings.shop.cpfHelp}`;

  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5 space-y-4">
      <h2 className="text-base font-semibold">{t.settings.shop.heading}</h2>
      <Field
        label={t.settings.shop.shopName}
        icon={Store}
        required
        minLength={2}
        maxLength={80}
        value={shop.shopName}
        onChange={(e) => setShop({ ...shop, shopName: e.currentTarget.value })}
      />
      <Field
        label={t.settings.shop.legalName}
        value={shop.legalName}
        onChange={(e) => setShop({ ...shop, legalName: e.currentTarget.value })}
      />
      <Field
        label={`${t.settings.shop.cnpj} / ${t.settings.shop.cpf}`}
        icon={FileDigit}
        inputMode="numeric"
        helper={docHelp}
        value={shop.document}
        onChange={(e) => setShop({ ...shop, document: e.currentTarget.value.replace(/\D/g, '') })}
      />
      <SelectField
        label={t.settings.shop.primaryPixKeyType}
        value={shop.primaryPixKeyType}
        onChange={(e) =>
          setShop({ ...shop, primaryPixKeyType: e.currentTarget.value as PixKeyType })
        }
        options={[
          { value: 'cpf', label: t.signup.pixTypes.cpf },
          { value: 'cnpj', label: t.signup.pixTypes.cnpj },
          { value: 'email', label: t.signup.pixTypes.email },
          { value: 'phone', label: t.signup.pixTypes.phone },
          { value: 'random', label: t.signup.pixTypes.random },
        ]}
      />
      <Field
        label={t.settings.shop.primaryPixKey}
        icon={KeyRound}
        required
        value={shop.primaryPixKey}
        onChange={(e) => setShop({ ...shop, primaryPixKey: e.currentTarget.value })}
        error={pixErr}
        helper={pixErr ? undefined : t.settings.shop.primaryPixKeyHelp[shop.primaryPixKeyType]}
      />
      <Field
        label={t.settings.shop.whatsappPhone}
        type="tel"
        icon={Phone}
        placeholder="+5511999998888"
        helper={t.settings.shop.whatsappPhoneHelp}
        value={shop.whatsappPhone}
        onChange={(e) => setShop({ ...shop, whatsappPhone: e.currentTarget.value })}
      />
      <SelectField
        label="Fuso horário"
        value={shop.timezone}
        onChange={(e) => setShop({ ...shop, timezone: e.currentTarget.value })}
        options={[
          { value: 'America/Sao_Paulo', label: 'Brasília / São Paulo' },
          { value: 'America/Manaus', label: 'Manaus' },
          { value: 'America/Fortaleza', label: 'Fortaleza' },
          { value: 'America/Rio_Branco', label: 'Rio Branco' },
        ]}
      />
      <div className="border-t border-[var(--color-border)] pt-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Endereço público</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Usado na página pública e nas confirmações de agendamento.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field
            label="Rua"
            value={shop.street}
            onChange={(e) => setShop({ ...shop, street: e.currentTarget.value })}
          />
          <Field
            label="Número"
            value={shop.number}
            onChange={(e) => setShop({ ...shop, number: e.currentTarget.value })}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Complemento"
            value={shop.complement}
            onChange={(e) => setShop({ ...shop, complement: e.currentTarget.value })}
          />
          <Field
            label="Bairro"
            value={shop.neighborhood}
            onChange={(e) => setShop({ ...shop, neighborhood: e.currentTarget.value })}
          />
          <Field
            label="Cidade"
            value={shop.city}
            onChange={(e) => setShop({ ...shop, city: e.currentTarget.value })}
          />
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <Field
              label="UF"
              value={shop.state}
              maxLength={2}
              onChange={(e) => setShop({ ...shop, state: e.currentTarget.value.toUpperCase() })}
            />
            <Field
              label="CEP"
              inputMode="numeric"
              value={shop.zip}
              onChange={(e) => setShop({ ...shop, zip: e.currentTarget.value })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HoursTab({ hours, setHours }: { hours: HoursState; setHours: (v: HoursState) => void }) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t.settings.hours.heading}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t.settings.hours.description}
        </p>
      </div>
      <div className="space-y-2">
        {DAY_ORDER.map((day) => {
          const d = hours[day];
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-3 py-2"
            >
              <label className="flex items-center gap-2 text-sm font-medium w-32 shrink-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-primary)]"
                  checked={d.enabled}
                  onChange={(e) =>
                    setHours({
                      ...hours,
                      [day]: { ...d, enabled: e.currentTarget.checked },
                    })
                  }
                />
                {t.settings.hours.days[day]}
              </label>
              {d.enabled ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--color-text-muted)]">{t.settings.hours.open}</span>
                  <input
                    type="time"
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
                    value={d.open}
                    onChange={(e) =>
                      setHours({
                        ...hours,
                        [day]: { ...d, open: e.currentTarget.value },
                      })
                    }
                  />
                  <span className="text-[var(--color-text-muted)]">{t.settings.hours.close}</span>
                  <input
                    type="time"
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
                    value={d.close}
                    onChange={(e) =>
                      setHours({
                        ...hours,
                        [day]: { ...d, close: e.currentTarget.value },
                      })
                    }
                  />
                </div>
              ) : (
                <span className="text-sm text-[var(--color-text-muted)] italic">
                  {t.settings.hours.closed}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BrandingTab({
  branding,
  setBranding,
}: {
  branding: BrandingFormState;
  setBranding: (v: BrandingFormState) => void;
}) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t.settings.branding.heading}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t.settings.branding.themePickerHelp}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">
          {t.settings.branding.themePickerHeading}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map((preset) => {
            const selected = branding.themeId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setBranding({ ...branding, themeId: preset.id })}
                className={`relative rounded-lg border p-3 text-left transition ${
                  selected
                    ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                    : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 shrink-0 rounded-md border border-black/5"
                    style={{ background: preset.palette.primary }}
                    aria-hidden
                  />
                  <div
                    className="h-7 w-7 shrink-0 rounded-md border border-black/5"
                    style={{ background: preset.palette.accent }}
                    aria-hidden
                  />
                  <div
                    className="h-7 w-7 shrink-0 rounded-md border border-black/5"
                    style={{ background: preset.palette.surfaceDark }}
                    aria-hidden
                  />
                  <div className="ml-auto text-xs text-[var(--color-text-muted)]">
                    {selected ? t.settings.branding.themeSelected : ''}
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--color-text)]">
                  {preset.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {t.settings.branding.imagesHeading}
        </h3>
        <Field
          label={t.settings.branding.logoUrl}
          type="url"
          placeholder="https://..."
          helper={t.settings.branding.logoUrlHelp}
          value={branding.logoUrl}
          onChange={(e) => setBranding({ ...branding, logoUrl: e.currentTarget.value })}
        />
        <Field
          label={t.settings.branding.coverUrl}
          type="url"
          placeholder="https://..."
          helper={t.settings.branding.coverUrlHelp}
          value={branding.coverUrl}
          onChange={(e) => setBranding({ ...branding, coverUrl: e.currentTarget.value })}
        />
      </div>
    </section>
  );
}

function ThemePreview({
  branding,
  shop,
}: {
  branding: BrandingFormState;
  shop: ShopFormState;
}) {
  const preset = findPreset(branding.themeId);
  const p = preset.palette;
  return (
    <div
      className="mt-4 overflow-hidden rounded-lg border"
      style={{ borderColor: p.border, background: p.bg }}
    >
      <div className="p-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-md text-sm font-bold"
          style={{ background: p.primary, color: p.primaryOn }}
        >
          {(shop.shopName || 'CP').slice(0, 2).toUpperCase()}
        </div>
        <p className="mt-4 text-lg font-semibold" style={{ color: p.text }}>
          {shop.shopName || t.app.name}
        </p>
        <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
          {shop.city
            ? `${shop.city}${shop.state ? `, ${shop.state.toUpperCase()}` : ''}`
            : shop.whatsappPhone || t.settings.shop.whatsappPhone}
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-md px-4 py-2 text-sm font-semibold"
          style={{ background: p.accent, color: p.accentOn }}
          tabIndex={-1}
          aria-hidden
        >
          {t.settings.branding.previewCta}
        </button>
      </div>
    </div>
  );
}

// Window helper kept for future multi-window support.
export type { HoursWindow };
