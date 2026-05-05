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
  ThemeConfig,
  UpdateOrganizationInput,
} from '@cadeirapro/shared';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { Field, SelectField } from '../components/Field';
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
}

interface BrandingFormState {
  primary: string;
  accent: string;
  logoUrl: string;
}

const DEFAULT_DAY: DayState = { enabled: false, open: '09:00', close: '18:00' };

const DEFAULT_PRIMARY = '#1e293b';
const DEFAULT_ACCENT = '#f59e0b';

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

function shopFromOrg(org: Organization): ShopFormState {
  return {
    shopName: org.name,
    legalName: org.legalName ?? '',
    document: org.cnpj ?? org.cpf ?? '',
    primaryPixKey: org.primaryPixKey,
    primaryPixKeyType: org.primaryPixKeyType,
    whatsappPhone: org.whatsappPhone ?? '',
  };
}

function brandingFromOrg(org: Organization): BrandingFormState {
  const cfg = (org.themeConfig ?? {}) as ThemeConfig;
  return {
    primary: cfg.primary ?? DEFAULT_PRIMARY,
    accent: cfg.accent ?? DEFAULT_ACCENT,
    logoUrl: cfg.logoUrl ?? '',
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

  // Hydrate form state once /v1/me lands.
  useEffect(() => {
    if (!org) return;
    setShop(shopFromOrg(org));
    setHours(hoursMapToState(org.hours as HoursMap | null | undefined));
    setBranding(brandingFromOrg(org));
  }, [org?.id, org?.updatedAt]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!shop || !hours || !branding) {
        return Promise.reject(new Error('settings_not_ready'));
      }
      const digits = shop.document.replace(/\D/g, '');
      const patch: UpdateOrganizationInput = {
        name: shop.shopName.trim(),
        legalName: shop.legalName.trim() || null,
        cnpj: digits.length === 14 ? digits : null,
        cpf: digits.length === 11 ? digits : null,
        primaryPixKey: shop.primaryPixKey.trim(),
        primaryPixKeyType: shop.primaryPixKeyType,
        whatsappPhone: shop.whatsappPhone.trim() || null,
        hours: hoursStateToMap(hours),
        themeConfig: {
          primary: branding.primary,
          accent: branding.accent,
          logoUrl: branding.logoUrl.trim() || null,
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
        <SettingsMetric label="WhatsApp" value={shop.whatsappPhone || t.common.none} />
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

            <div className="flex justify-end">
              <Button type="submit" loading={saveMutation.isPending}>
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
      <div
        className="mt-4 overflow-hidden rounded-lg border border-[var(--color-border)]"
        style={{ background: branding.primary, color: '#fff' }}
      >
        <div className="p-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-md text-sm font-bold"
            style={{ background: branding.accent, color: '#111827' }}
          >
            CP
          </div>
          <p className="mt-4 text-lg font-semibold">{shop.shopName || t.app.name}</p>
          <p className="mt-1 text-sm opacity-75">
            {shop.whatsappPhone || t.settings.shop.whatsappPhone}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm text-[var(--color-text-muted)]">
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
      </div>
    </aside>
  );
}

function ShopTab({ shop, setShop }: { shop: ShopFormState; setShop: (v: ShopFormState) => void }) {
  const docDigits = useMemo(() => shop.document.replace(/\D/g, ''), [shop.document]);
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
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t.settings.branding.heading}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t.settings.branding.description}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ColorField
          label={t.settings.branding.primaryColor}
          value={branding.primary}
          onChange={(v) => setBranding({ ...branding, primary: v })}
        />
        <ColorField
          label={t.settings.branding.accentColor}
          value={branding.accent}
          onChange={(v) => setBranding({ ...branding, accent: v })}
        />
      </div>
      <Field
        label={t.settings.branding.logoUrl}
        type="url"
        placeholder="https://..."
        helper={t.settings.branding.logoUrlHelp}
        value={branding.logoUrl}
        onChange={(e) => setBranding({ ...branding, logoUrl: e.currentTarget.value })}
      />
      <div>
        <Button
          variant="ghost"
          onClick={() =>
            setBranding({ primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT, logoUrl: '' })
          }
        >
          {t.settings.branding.reset}
        </Button>
      </div>
    </section>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</span>
      <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <input
          type="color"
          className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
        <input
          type="text"
          className="flex-1 bg-transparent text-sm font-mono outline-none"
          value={value}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
              onChange(v.startsWith('#') ? v : `#${v}`);
            }
          }}
          maxLength={7}
        />
      </div>
    </label>
  );
}

// Window helper kept for future multi-window support.
export type { HoursWindow };
