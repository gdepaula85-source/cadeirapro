// Theme presets for the customer-facing surfaces (public booking + /[:slug]
// customer pages). The dashboard has its own --color-* vars; these --cp-*
// vars are only applied to customer-facing routes via <PublicThemeApplier/>.
//
// Adding a theme:
//   1. Add a new entry to PRESETS with a unique id and a full palette.
//   2. The Settings → Branding picker auto-discovers it.
//   3. CSS vars on :root get rewritten when the active theme changes.

export interface ThemePalette {
  bg: string;
  surface: string;
  surfaceSoft: string;
  surfaceDark: string;
  surfaceDarkHi: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryHover: string;
  primaryTint: string;
  primarySoft: string;
  primaryOn: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentOn: string;
  danger: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  palette: ThemePalette;
}

export const DEFAULT_THEME_ID = 'verde-mata';

export const PRESETS: ThemePreset[] = [
  {
    id: 'verde-mata',
    name: 'Verde mata',
    description: 'Verde profundo e tons naturais. O visual padrão da CadeiraPro.',
    palette: {
      bg: '#f6f8f5',
      surface: '#ffffff',
      surfaceSoft: '#fbfdf9',
      surfaceDark: '#021b15',
      surfaceDarkHi: '#06251c',
      text: '#101713',
      textMuted: '#647067',
      border: '#dfe7dc',
      primary: '#176527',
      primaryHover: '#125020',
      primaryTint: '#edf7e9',
      primarySoft: '#a8d5a1',
      primaryOn: '#ffffff',
      accent: '#68c65b',
      accentHover: '#77d76b',
      accentSoft: '#8de47f',
      accentOn: '#07130a',
      danger: '#b21f3a',
    },
  },
  {
    id: 'preto-e-dourado',
    name: 'Preto e dourado',
    description: 'Barbearia clássica. Preto com toques de ouro.',
    palette: {
      bg: '#f5f4f1',
      surface: '#ffffff',
      surfaceSoft: '#faf8f4',
      surfaceDark: '#0a0a0a',
      surfaceDarkHi: '#1a1a1a',
      text: '#1a1a1a',
      textMuted: '#6b6b6b',
      border: '#e5e3dd',
      primary: '#1a1a1a',
      primaryHover: '#000000',
      primaryTint: '#f5f0e0',
      primarySoft: '#d4af37',
      primaryOn: '#d4af37',
      accent: '#d4af37',
      accentHover: '#c9a02c',
      accentSoft: '#f0d878',
      accentOn: '#1a1a1a',
      danger: '#b21f3a',
    },
  },
  {
    id: 'marinho-classico',
    name: 'Marinho clássico',
    description: 'Azul marinho e branco. Sóbrio e confiável.',
    palette: {
      bg: '#f4f6fa',
      surface: '#ffffff',
      surfaceSoft: '#fafbfd',
      surfaceDark: '#0c1a3a',
      surfaceDarkHi: '#14245a',
      text: '#0c1a3a',
      textMuted: '#5a657a',
      border: '#d8dde8',
      primary: '#1e3a8a',
      primaryHover: '#14245a',
      primaryTint: '#e3eafc',
      primarySoft: '#93c5fd',
      primaryOn: '#ffffff',
      accent: '#3b82f6',
      accentHover: '#2563eb',
      accentSoft: '#93c5fd',
      accentOn: '#0c1a3a',
      danger: '#b21f3a',
    },
  },
  {
    id: 'bordo',
    name: 'Bordô',
    description: 'Vinho profundo e creme. Vintage e elegante.',
    palette: {
      bg: '#faf6f5',
      surface: '#ffffff',
      surfaceSoft: '#fdfaf9',
      surfaceDark: '#2a0a0e',
      surfaceDarkHi: '#3f0f15',
      text: '#2a0a0e',
      textMuted: '#6e5b5d',
      border: '#e8dcd9',
      primary: '#7f1d1d',
      primaryHover: '#5c1414',
      primaryTint: '#fbe5e3',
      primarySoft: '#fca5a5',
      primaryOn: '#ffffff',
      accent: '#dc2626',
      accentHover: '#b91c1c',
      accentSoft: '#fca5a5',
      accentOn: '#2a0a0e',
      danger: '#b21f3a',
    },
  },
  {
    id: 'areia',
    name: 'Areia',
    description: 'Marrom quente e dourado. Acolhedor e neutro.',
    palette: {
      bg: '#fdf9f3',
      surface: '#ffffff',
      surfaceSoft: '#fcf6ed',
      surfaceDark: '#2a1810',
      surfaceDarkHi: '#3f2418',
      text: '#2a1810',
      textMuted: '#7a6354',
      border: '#e8d9c4',
      primary: '#78350f',
      primaryHover: '#5a2808',
      primaryTint: '#fef3e2',
      primarySoft: '#fcd97d',
      primaryOn: '#ffffff',
      accent: '#fbbf24',
      accentHover: '#f59e0b',
      accentSoft: '#fcd97d',
      accentOn: '#2a1810',
      danger: '#b21f3a',
    },
  },
  {
    id: 'carbono',
    name: 'Carbono',
    description: 'Cinza grafite e azul elétrico. Visual moderno.',
    palette: {
      bg: '#f2f4f6',
      surface: '#ffffff',
      surfaceSoft: '#f7f9fa',
      surfaceDark: '#1a1d22',
      surfaceDarkHi: '#2a2e34',
      text: '#1a1d22',
      textMuted: '#6b7280',
      border: '#d8dde2',
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primaryTint: '#dbeafe',
      primarySoft: '#93c5fd',
      primaryOn: '#ffffff',
      accent: '#06b6d4',
      accentHover: '#0891b2',
      accentSoft: '#67e8f9',
      accentOn: '#1a1d22',
      danger: '#b21f3a',
    },
  },
];

export function findPreset(themeId: string | null | undefined): ThemePreset {
  if (!themeId) return PRESETS[0]!;
  return PRESETS.find((p) => p.id === themeId) ?? PRESETS[0]!;
}

// Mapping from ThemePalette key → CSS variable name on :root.
export const VAR_MAP: Record<keyof ThemePalette, string> = {
  bg: '--cp-bg',
  surface: '--cp-surface',
  surfaceSoft: '--cp-surface-soft',
  surfaceDark: '--cp-surface-dark',
  surfaceDarkHi: '--cp-surface-dark-hi',
  text: '--cp-text',
  textMuted: '--cp-text-muted',
  border: '--cp-border',
  primary: '--cp-primary',
  primaryHover: '--cp-primary-hover',
  primaryTint: '--cp-primary-tint',
  primarySoft: '--cp-primary-soft',
  primaryOn: '--cp-primary-on',
  accent: '--cp-accent',
  accentHover: '--cp-accent-hover',
  accentSoft: '--cp-accent-soft',
  accentOn: '--cp-accent-on',
  danger: '--cp-danger',
};
