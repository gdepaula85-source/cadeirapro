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
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center text-sm font-bold text-[var(--color-primary-fg)]"
              style={{ background: 'var(--color-primary)' }}
              aria-hidden
            >
              CP
            </div>
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text)] tracking-tight">
            {t.app.name}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{t.app.tagline}</p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--color-text)] tracking-tight">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </div>
        {footer ? (
          <div className="text-center mt-5 text-sm text-[var(--color-text-muted)]">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
