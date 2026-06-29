import { useEffect, useState } from "react";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { toDisplayTime } from "../domain/routePlannerHelpers";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";

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

const PencilIcon = ({ className }: { className?: string }) => (
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
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
                  ? `${destination.windowStart ? toDisplayTime(destination.windowStart) : "–"} – ${destination.windowEnd ? toDisplayTime(destination.windowEnd) : "–"}`
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
  showIndex?: boolean;
  avatarInitials?: string;
  roundedLarge?: boolean;
  inlineScheduledPill?: boolean;
  compact?: boolean;
  displayName?: string;
  displaySubtitle?: string;
  inputLabelPrefix?: string;
  removeAriaLabel?: string;
  isExpanded: boolean;
  onToggleDetails: () => void;
  onRemove: () => void;
  onSetIncluded: (v: boolean) => void;
  onUpdateWindow: (field: "windowStart" | "windowEnd" | "planningDate", value: string) => void;
  onSetPersistWindow: (v: boolean) => void;
  activeVisitInstanceActionId: string | null;
  onVisitInstanceStatusChange: (
    visitId: string,
    status: "scheduled" | "cancelled",
  ) => Promise<void>;
  onVisitInstanceReschedule: (
    visitId: string,
    updates: { planningDate?: string; windowStart?: string; windowEnd?: string },
  ) => Promise<void>;
};

export const DestinationRow = ({
  destination,
  index,
  showIndex = true,
  avatarInitials,
  roundedLarge = false,
  inlineScheduledPill = false,
  compact = false,
  displayName,
  displaySubtitle,
  inputLabelPrefix,
  removeAriaLabel,
  isExpanded,
  onToggleDetails,
  onRemove,
  onSetIncluded,
  onUpdateWindow,
  onSetPersistWindow,
  activeVisitInstanceActionId,
  onVisitInstanceStatusChange,
  onVisitInstanceReschedule,
}: DestinationRowProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const visibleName = displayName ?? destination.patientName;
  const fieldLabelPrefix = inputLabelPrefix ?? destination.patientName;
  const removeLabel = removeAriaLabel ?? `Remove ${destination.patientName}`;
  const isVisitInstance = typeof destination.visitId === "string" && destination.visitId.length > 0;
  const isCancelledOccurrence = destination.visitStatus === "cancelled";
  const isVisitActionPending =
    isVisitInstance && activeVisitInstanceActionId === destination.visitId;
  const hasOccurrenceChanges =
    isVisitInstance &&
    !isCancelledOccurrence &&
    ((destination.planningDate ?? "") !== (destination.originalPlanningDate ?? "") ||
      destination.windowStart !== (destination.originalWindowStart ?? destination.windowStart) ||
      destination.windowEnd !== (destination.originalWindowEnd ?? destination.windowEnd));

  const scheduledPill = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight ${
        isCancelledOccurrence
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
    >
      <span aria-hidden="true">•</span>
      {isCancelledOccurrence ? "Skipped" : "Scheduled"}
    </span>
  );

  return (
    <div
      className={`flex flex-col justify-center border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 ${
        roundedLarge ? "rounded-2xl" : "rounded-xl"
      } ${compact ? "min-h-11 py-2" : "min-h-14 py-2.5"} ${
        destination.isIncluded ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        {showIndex && <span className={responsiveStyles.destinationIndex}>{index + 1}.</span>}
        {avatarInitials && (
          <span className={responsiveStyles.clientAvatar} aria-hidden="true">
            {avatarInitials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={responsiveStyles.destinationNameButton}
            title={destination.patientName}
          >
            {visibleName}
          </button>
          {(displaySubtitle || inlineScheduledPill) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {displaySubtitle && (
                <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                  {displaySubtitle}
                </p>
              )}
              {inlineScheduledPill && scheduledPill}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!inlineScheduledPill && <span className="hidden sm:inline-flex">{scheduledPill}</span>}
          <button
            type="button"
            onClick={onToggleDetails}
            aria-label={isExpanded ? "Hide details" : "Edit window"}
            className={responsiveStyles.destinationEditIcon}
          >
            {isExpanded ? (
              <XIcon className="h-3.5 w-3.5" />
            ) : (
              <PencilIcon className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className={responsiveStyles.destinationRemoveIcon}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {!inlineScheduledPill && (
        <div className="mt-1 flex items-center gap-1.5 sm:hidden">{scheduledPill}</div>
      )}

      {isExpanded && (
        <div className="mt-2 ml-8">
          {isVisitInstance && destination.visitId && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isCancelledOccurrence ? (
                <button
                  type="button"
                  disabled={isVisitActionPending}
                  onClick={() =>
                    onVisitInstanceStatusChange(destination.visitId as string, "scheduled")
                  }
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVisitActionPending ? "Restoring..." : "Restore occurrence"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isVisitActionPending}
                    onClick={() =>
                      onVisitInstanceStatusChange(destination.visitId as string, "cancelled")
                    }
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {isVisitActionPending ? "Skipping..." : "Skip occurrence"}
                  </button>
                  <button
                    type="button"
                    disabled={!hasOccurrenceChanges || isVisitActionPending}
                    onClick={() =>
                      onVisitInstanceReschedule(destination.visitId as string, {
                        ...(destination.planningDate !== destination.originalPlanningDate
                          ? { planningDate: destination.planningDate }
                          : {}),
                        ...(destination.windowStart !== destination.originalWindowStart
                          ? { windowStart: destination.windowStart }
                          : {}),
                        ...(destination.windowEnd !== destination.originalWindowEnd
                          ? { windowEnd: destination.windowEnd }
                          : {}),
                      })
                    }
                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVisitActionPending ? "Saving..." : "Save occurrence changes"}
                  </button>
                </>
              )}
            </div>
          )}
          {!isCancelledOccurrence && (
            <label className={responsiveStyles.visitWindowCheckboxLabel}>
              <input
                type="checkbox"
                checked={destination.isIncluded}
                onChange={(e) => onSetIncluded(e.target.checked)}
              />
              Include this visit in route
            </label>
          )}
          <div className="mt-2">
            <p className={responsiveStyles.cardDescription}>
              {isCancelledOccurrence
                ? "This occurrence is skipped. Restore it to include it in route planning again."
                : destination.requiresPlanningWindow
                  ? "No preferred window. Optimizer will auto-schedule unless you set one:"
                  : "Adjust planning window (plan-only unless saved):"}
            </p>
            {!isCancelledOccurrence && isVisitInstance && (
              <div className="mt-2 flex flex-col gap-1">
                <label
                  htmlFor={`${destination.visitKey}-planning-date`}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {fieldLabelPrefix} date
                </label>
                <input
                  id={`${destination.visitKey}-planning-date`}
                  type="date"
                  aria-label={`${fieldLabelPrefix} date`}
                  value={destination.planningDate ?? ""}
                  onChange={(e) => onUpdateWindow("planningDate", e.target.value)}
                  className={responsiveStyles.timeInput}
                />
              </div>
            )}
            {!isCancelledOccurrence && (
              <div className="mt-1 flex items-center gap-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="time"
                    aria-label={`${fieldLabelPrefix} start`}
                    value={destination.windowStart}
                    onChange={(e) => onUpdateWindow("windowStart", e.target.value)}
                    className={responsiveStyles.timeInput}
                  />
                  <input
                    type="time"
                    aria-label={`${fieldLabelPrefix} end`}
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
            )}
            {!isVisitInstance && !isCancelledOccurrence && (
              <label className={responsiveStyles.visitWindowCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={destination.persistPlanningWindow}
                  onChange={(e) => onSetPersistWindow(e.target.checked)}
                />
                Save this window to client record
              </label>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <PatientInfoModal destination={destination} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};
