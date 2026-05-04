// Centered card layout for login + signup pages. The dashboard layout is
// separate (sidebar + top bar).
import type { ReactNode } from 'react';
import { t } from '../strings/pt-BR';

interface StepIndicatorProps {
  step: number;
  total: number;
}

function StepIndicator({ step, total }: StepIndicatorProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex-1 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
            }`}
          />
        ))}
      </div>
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
        {t.signup.stepLabel(step, total)}
      </span>
    </div>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  step,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  step?: { current: number; total: number };
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
          {step ? <StepIndicator step={step.current} total={step.total} /> : null}
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
