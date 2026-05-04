// Tiny form-field primitive. Avoids per-page boilerplate without pulling in
// a UI lib for §7. Build Guide §14.1: pt-BR copy comes from strings/pt-BR.ts.
import {
  forwardRef,
  type ComponentType,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';
import type { LucideProps } from 'lucide-react';

type IconType = ComponentType<LucideProps>;

interface BaseProps {
  label: string;
  helper?: string;
  error?: string | undefined;
  icon?: IconType;
  children?: ReactNode;
}

const labelClass = 'block text-sm font-medium text-[var(--color-text)] mb-1.5';
const inputBase =
  'block w-full rounded-md border bg-[var(--color-surface)] px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 disabled:opacity-60 transition-colors';
const inputOk =
  'border-[var(--color-border)] focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]';
const inputErr = 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]/25';
const helperClass = 'mt-1 text-xs text-[var(--color-text-muted)]';
const errorClass = 'mt-1 text-xs text-[var(--color-danger)] flex items-center gap-1';

export const Field = forwardRef<
  HTMLInputElement,
  BaseProps & InputHTMLAttributes<HTMLInputElement>
>(function Field({ label, helper, error, icon: Icon, children: _c, className = '', ...rest }, ref) {
  const hasIcon = !!Icon;
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="relative">
        {hasIcon ? (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            aria-hidden
          >
            <Icon size={16} />
          </span>
        ) : null}
        <input
          ref={ref}
          className={`${inputBase} ${error ? inputErr : inputOk} ${hasIcon ? 'pl-9' : ''} ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <span className={errorClass}>
          <span aria-hidden>•</span>
          {error}
        </span>
      ) : helper ? (
        <span className={helperClass}>{helper}</span>
      ) : null}
    </label>
  );
});

interface SelectFieldProps
  extends BaseProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: Array<{ value: string; label: string }>;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, helper, error, icon: Icon, options, className = '', ...rest },
  ref,
) {
  const hasIcon = !!Icon;
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="relative">
        {hasIcon ? (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            aria-hidden
          >
            <Icon size={16} />
          </span>
        ) : null}
        <select
          ref={ref}
          className={`${inputBase} ${error ? inputErr : inputOk} ${hasIcon ? 'pl-9' : ''} ${className}`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <span className={errorClass}>
          <span aria-hidden>•</span>
          {error}
        </span>
      ) : helper ? (
        <span className={helperClass}>{helper}</span>
      ) : null}
    </label>
  );
});
