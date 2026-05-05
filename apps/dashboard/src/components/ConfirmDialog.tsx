import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';
import { t } from '../strings/pt-BR';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!loading) onCancel();
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
        <div className="px-5 pt-5 pb-3">
          <h2
            id="confirm-dialog-title"
            className="text-base font-semibold text-[var(--color-text)]"
          >
            {title}
          </h2>
          {body ? (
            <div className="mt-2 text-sm text-[var(--color-text-muted)]">{body}</div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t.common.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className={
              variant === 'danger'
                ? 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white'
                : ''
            }
          >
            {confirmLabel ?? t.common.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
