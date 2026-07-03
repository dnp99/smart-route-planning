import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { responsiveStyles } from "../responsiveStyles";

type InfoDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// Small explanatory dialog (portaled over whatever is on screen) opened from an
// "i" affordance. Closes on the X, backdrop click, Escape, or the Got it button.
export function InfoDialog({ open, title, onClose, children }: InfoDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className={responsiveStyles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={responsiveStyles.confirmDialogSurface}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className={responsiveStyles.confirmDialogTitle}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
        <div className="mt-1 flex justify-end">
          <button type="button" onClick={onClose} className={responsiveStyles.primaryButton}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
