import { useEffect } from "react";
import { responsiveStyles } from "../responsiveStyles";

export default function LegalDocumentModal({ title, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={responsiveStyles.modalBackdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={responsiveStyles.legalDocumentModalSurface}>
        <div className={responsiveStyles.legalDocumentModalHeader}>
          <p className={responsiveStyles.legalDocumentModalTitle}>{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal document"
            className={responsiveStyles.legalDocumentModalCloseButton}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className={responsiveStyles.legalDocumentModalBody}>
          {children}
        </div>
      </div>
    </div>
  );
}
