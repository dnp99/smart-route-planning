import { useEffect } from "react";
import { responsiveStyles } from "../responsiveStyles";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  isLoading = false,
  title,
  confirmLabel = "Confirm",
  confirmLoadingLabel = "Loading...",
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, onCancel]);

  return (
    <div
      className={responsiveStyles.modalBackdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div className={responsiveStyles.confirmDialogSurface}>
        {title && <p className={responsiveStyles.confirmDialogTitle}>{title}</p>}
        <p className={responsiveStyles.confirmDialogMessage}>{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={responsiveStyles.secondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={responsiveStyles.destructiveButton}
          >
            {isLoading ? confirmLoadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
