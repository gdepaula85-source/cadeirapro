// Centered card layout for login + signup pages. The dashboard layout is
// separate (sidebar + top bar).
import type { ReactNode } from 'react';
import { t } from '../strings/pt-BR';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{t.app.name}</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{t.app.tagline}</p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
            {subtitle ? (
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{subtitle}</p>
            ) : null}
          </div>
          {children}
        </div>
        {footer ? (
          <div className="text-center mt-4 text-sm text-[var(--color-text-muted)]">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
