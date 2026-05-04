// Reads the current organization's themeConfig and writes per-shop CSS
// variables onto :root. Tailwind 4's @theme tokens still provide the
// defaults; these overrides win because they're set on documentElement
// (higher specificity than @theme defaults).
//
// Mounts inside the authenticated dashboard layout (where /v1/me data is
// already in TanStack Query cache).
import { useEffect } from 'react';
import type { ThemeConfig } from '@cadeirapro/shared';

interface Props {
  themeConfig: ThemeConfig | null | undefined;
}

const VARS_FROM_THEME: Record<keyof Pick<ThemeConfig, 'primary' | 'accent'>, string> = {
  primary: '--color-primary',
  accent: '--color-accent',
};

export function ThemeApplier({ themeConfig }: Props) {
  useEffect(() => {
    const root = document.documentElement;

    // Apply each set property; remove anything not present so we don't leak
    // stale values when navigating between sessions.
    for (const [key, cssVar] of Object.entries(VARS_FROM_THEME)) {
      const value = themeConfig?.[key as keyof typeof VARS_FROM_THEME];
      if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
        root.style.setProperty(cssVar, value);
      } else {
        root.style.removeProperty(cssVar);
      }
    }

    return () => {
      // On unmount (sign-out, etc.), drop overrides so the next user starts
      // from the default tokens.
      for (const cssVar of Object.values(VARS_FROM_THEME)) {
        root.style.removeProperty(cssVar);
      }
    };
  }, [themeConfig?.primary, themeConfig?.accent]);

  return null;
}
