import { useEffect, useState } from "react";
import { responsiveStyles } from "../responsiveStyles";
import type { SelectedPatientDestination } from "./routePlannerTypes";

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const PatientInfoModal = ({
  destination,
  onClose,
}: {
  destination: SelectedPatientDestination;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasWindow = destination.windowStart || destination.windowEnd;

  return (
    <div className={responsiveStyles.modalBackdrop} onClick={onClose}>
      <div className={responsiveStyles.confirmDialogSurface} onClick={(e) => e.stopPropagation()}>
        <div className={responsiveStyles.infoModalHeader}>
          <h3 className={responsiveStyles.confirmDialogTitle}>{destination.patientName}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={responsiveStyles.infoModalCloseButton}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className={responsiveStyles.infoModalBody}>
          <div>
            <p className={responsiveStyles.infoModalSectionLabel}>Address</p>
            <p className={responsiveStyles.infoModalSectionValue}>{destination.address}</p>
          </div>
          <div>
            <p className={responsiveStyles.infoModalSectionLabel}>Time window</p>
            <div className="mt-1 flex items-center gap-2">
              <p className={responsiveStyles.infoModalSectionValueInline}>
                {hasWindow
                  ? `${destination.windowStart || "–"} – ${destination.windowEnd || "–"}`
                  : "No window set"}
              </p>
              <span
                className={`${responsiveStyles.visitTypePillBase} ${
                  destination.windowType === "fixed"
                    ? responsiveStyles.visitTypePillFixed
                    : responsiveStyles.visitTypePillFlexible
                }`}
              >
                {destination.windowType}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type DestinationRowProps = {
  destination: SelectedPatientDestination;
  index: number;
  isExpanded: boolean;
  onToggleDetails: () => void;
  onRemove: () => void;
  onSetIncluded: (v: boolean) => void;
  onUpdateWindow: (field: "windowStart" | "windowEnd", value: string) => void;
  onSetPersistWindow: (v: boolean) => void;
};

export const DestinationRow = ({
  destination,
  index,
  isExpanded,
  onToggleDetails,
  onRemove,
  onSetIncluded,
  onUpdateWindow,
  onSetPersistWindow,
}: DestinationRowProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <li
      className={`flex min-h-14 flex-col justify-center rounded-xl border border-transparent px-2 py-2 text-sm text-slate-900 dark:border-transparent dark:text-slate-200 ${destination.isIncluded ? "" : "opacity-60"}`}
    >
      <div className="flex items-center gap-2">
        <span className={responsiveStyles.destinationIndex}>{index + 1}.</span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={responsiveStyles.destinationNameButton}
            title={destination.patientName}
          >
            {destination.patientName}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleDetails}
            className={responsiveStyles.destinationDetailsToggle}
          >
            {isExpanded ? "Hide details" : "Edit window"}
          </button>
          <button
            type="button"
            aria-label={`Remove ${destination.patientName}`}
            onClick={onRemove}
            className={responsiveStyles.destinationRemoveIcon}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 ml-8">
          <label className={responsiveStyles.visitWindowCheckboxLabel}>
            <input
              type="checkbox"
              checked={destination.isIncluded}
              onChange={(e) => onSetIncluded(e.target.checked)}
            />
            Include this visit in route
          </label>
          <div className="mt-2">
            <p className={responsiveStyles.cardDescription}>
              {destination.requiresPlanningWindow
                ? "No preferred window. Optimizer will auto-schedule unless you set one:"
                : "Adjust planning window (plan-only unless saved):"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="time"
                  aria-label={`${destination.patientName} start`}
                  value={destination.windowStart}
                  onChange={(e) => onUpdateWindow("windowStart", e.target.value)}
                  className={responsiveStyles.timeInput}
                />
                <input
                  type="time"
                  aria-label={`${destination.patientName} end`}
                  value={destination.windowEnd}
                  onChange={(e) => onUpdateWindow("windowEnd", e.target.value)}
                  className={responsiveStyles.timeInput}
                />
              </div>
              {(destination.windowStart || destination.windowEnd) && (
                <button
                  type="button"
                  aria-label="Clear window"
                  onClick={() => {
                    onUpdateWindow("windowStart", "");
                    onUpdateWindow("windowEnd", "");
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M2 2l10 10M12 2L2 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
            <label className={responsiveStyles.visitWindowCheckboxLabel}>
              <input
                type="checkbox"
                checked={destination.persistPlanningWindow}
                onChange={(e) => onSetPersistWindow(e.target.checked)}
              />
              Save this window to patient record
            </label>
          </div>
        </div>
      )}

      {isModalOpen && (
        <PatientInfoModal destination={destination} onClose={() => setIsModalOpen(false)} />
      )}
    </li>
  );
};
