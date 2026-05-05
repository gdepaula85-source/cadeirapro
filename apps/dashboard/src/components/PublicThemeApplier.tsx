// Mounts on customer-facing routes (/book/:slug, /:slug/*) to write the
// active theme's palette as --cp-* CSS variables on document.documentElement.
//
// Distinct from ThemeApplier (the dashboard one), which writes a different
// var prefix (--color-*) and only handles primary/accent. The customer app
// has its own --cp-* prefix because the per-shop theme should NOT recolor
// the dashboard.
import { useEffect } from 'react';
import { findPreset, VAR_MAP, type ThemePalette } from '../lib/themes';

interface Props {
  themeId: string | null | undefined;
}

export function PublicThemeApplier({ themeId }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    const preset = findPreset(themeId);

    for (const key of Object.keys(VAR_MAP) as Array<keyof ThemePalette>) {
      root.style.setProperty(VAR_MAP[key], preset.palette[key]);
    }

    return () => {
      for (const cssVar of Object.values(VAR_MAP)) {
        root.style.removeProperty(cssVar);
      }
    };
  }, [themeId]);

  return null;
}
