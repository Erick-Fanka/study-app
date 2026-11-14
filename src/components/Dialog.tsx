import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

// Janela modal usando o <dialog> nativo (foco, Esc e acessibilidade do próprio navegador).
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clique no fundo escuro fecha.
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          <header className="dialog-head">
            <h2 id="dialog-title">{title}</h2>
            <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Fechar">
              <Icon name="close" size={18} />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busyLabel = "Apagando…",
  danger = true,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <div className="dialog-message">{message}</div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
