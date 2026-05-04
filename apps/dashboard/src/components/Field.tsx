// Tiny form-field primitive. Avoids per-page boilerplate without pulling in
// a UI lib for §7. Build Guide §14.1: pt-BR copy comes from strings/pt-BR.ts.
import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';

interface BaseProps {
  label: string;
  helper?: string;
  error?: string | undefined;
  children?: ReactNode;
}

const labelClass = 'block text-sm font-medium text-[var(--color-text)] mb-1';
const inputClass =
  'block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] disabled:opacity-60';
const helperClass = 'mt-1 text-xs text-[var(--color-text-muted)]';
const errorClass = 'mt-1 text-xs text-[var(--color-danger)]';

export const Field = forwardRef<
  HTMLInputElement,
  BaseProps & InputHTMLAttributes<HTMLInputElement>
>(function Field({ label, helper, error, children: _c, ...rest }, ref) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input ref={ref} className={inputClass} {...rest} />
      {error ? (
        <span className={errorClass}>{error}</span>
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
  { label, helper, error, options, ...rest },
  ref,
) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select ref={ref} className={inputClass} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className={errorClass}>{error}</span>
      ) : helper ? (
        <span className={helperClass}>{helper}</span>
      ) : null}
    </label>
  );
});
