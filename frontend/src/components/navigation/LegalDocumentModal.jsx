import { useEffect } from "react";

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[88vh] w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal document"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
        <div className="max-h-[calc(88vh-3.5rem)] overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}
