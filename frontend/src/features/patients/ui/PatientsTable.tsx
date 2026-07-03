import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Patient, RecurringVisitTemplate } from "../../../../../shared/contracts";
import { getPatientDisplayName, toTimeInput } from "../domain/patientForm";
import { getPatientInitials } from "../domain/patientName";
import { resolveVisitTypeLabel, type WindowFilter } from "../domain/visitType";
import { countActiveRecurringTemplates } from "../domain/recurringTemplate";
import { responsiveStyles } from "../../../components/responsiveStyles";

type SortField = "name" | "duration" | "lastScheduled" | null;
type SortDir = "asc" | "desc";

type PatientsTableProps = {
  isLoading: boolean;
  isSubmitting: boolean;
  patients: Patient[];
  lifecycleState: "active" | "idle" | "archived";
  searchQuery: string;
  windowFilter: WindowFilter;
  onWindowFilterChange: (windowFilter: WindowFilter) => void;
  onDelete: (patientId: string) => Promise<void> | void;
  onEdit: (patient: Patient) => void;
  selectedIds: Set<string>;
  onToggleSelect: (patientId: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onArchiveSelected: () => void;
  isBulkArchiving: boolean;
  onRestore: (patient: Patient) => void;
  restoringId: string | null;
  recurringTemplatesByPatientId: Map<string, RecurringVisitTemplate[]>;
  onAddClient: () => void;
};

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
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
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
    <path d="m16.5 3.5 4 4L8 20H4v-4z" />
  </svg>
);

const ArchiveIcon = ({ className }: { className?: string }) => (
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
    <path d="M21 8v13H3V8" />
    <path d="M1 3h22v5H1z" />
    <path d="M10 12h4" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </svg>
);

type PatientWindowRow = {
  id: string;
  timeLabel: string;
};

const formatTime12h = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}\u00A0${period}`;
};

const formatWindowRange = (startTime: string, endTime: string) =>
  `${formatTime12h(toTimeInput(startTime))}\u00A0-\u00A0${formatTime12h(toTimeInput(endTime))}`;

// Idle tab: relative age + date for the last time a client was put on a route.
const formatLastScheduled = (iso?: string | null): { primary: string; secondary: string } => {
  if (!iso) return { primary: "Never scheduled", secondary: "" };
  const then = new Date(iso).getTime();
  if (isNaN(then)) return { primary: "Never scheduled", secondary: "" };
  const days = Math.floor((Date.now() - then) / 86_400_000);
  const primary = days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  const secondary = new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { primary, secondary };
};

const splitAddress = (addr: string) => {
  const idx = addr.indexOf(", ");
  if (idx === -1) return { street: addr, cityRegion: "" };
  return { street: addr.slice(0, idx), cityRegion: addr.slice(idx + 2) };
};

const resolvePatientWindowRows = (patient: Patient): PatientWindowRow[] => {
  const windows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
  if (windows.length > 0) {
    return windows.map((window) => ({
      id: window.id,
      timeLabel: formatWindowRange(window.startTime, window.endTime),
    }));
  }

  if (patient.visitTimeType === "flexible") {
    return [
      {
        id: `${patient.id}-flexible-empty`,
        timeLabel: "Not set",
      },
    ];
  }

  return [
    {
      id: `${patient.id}-legacy`,
      timeLabel: formatWindowRange(patient.preferredVisitStartTime, patient.preferredVisitEndTime),
    },
  ];
};

const renderVisitTypePill = (visitType: "fixed" | "flexible" | "mixed") => {
  const typeClassName =
    visitType === "fixed"
      ? responsiveStyles.visitTypePillFixed
      : visitType === "flexible"
        ? responsiveStyles.visitTypePillFlexible
        : responsiveStyles.visitTypePillMixed;

  return (
    <span className={[responsiveStyles.visitTypePillBase, typeClassName].join(" ")}>
      {visitType}
    </span>
  );
};

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M7.22 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

const SortIcon = ({
  field,
  sortField,
  sortDir,
}: {
  field: "name" | "duration" | "lastScheduled";
  sortField: SortField;
  sortDir: SortDir;
}) => {
  if (sortField !== field) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-3.5 w-3.5 opacity-85"
      >
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }
  return sortDir === "asc" ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M12 19V5" />
      <path d="M7 10l5-5 5 5" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M12 5v14" />
      <path d="M17 14l-5 5-5-5" />
    </svg>
  );
};

export const PatientsTable = ({
  isLoading,
  isSubmitting,
  patients,
  lifecycleState,
  searchQuery,
  windowFilter,
  onWindowFilterChange,
  onDelete,
  onEdit,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onArchiveSelected,
  isBulkArchiving,
  onRestore,
  restoringId,
  recurringTemplatesByPatientId,
  onAddClient,
}: PatientsTableProps) => {
  const isArchived = lifecycleState === "archived";
  const isIdle = lifecycleState === "idle";
  const showRepeat = lifecycleState === "active";
  const [openWindowsPopoverKey, setOpenWindowsPopoverKey] = useState<string | null>(null);
  // Anchor rect captured on open — the panel is portaled to <body> (fixed
  // position) so the table card's overflow-hidden can't clip it.
  const [windowsPopoverAnchor, setWindowsPopoverAnchor] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);
  const windowsTriggerRef = useRef<HTMLDivElement | null>(null);
  const windowsPanelRef = useRef<HTMLDivElement | null>(null);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(() => new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Each tab has a sensible default sort: Idle leads with the most stale (oldest
  // last-scheduled) at the top; the others sort by name.
  useEffect(() => {
    if (isIdle) {
      setSortField("lastScheduled");
      setSortDir("asc");
    } else {
      setSortField("name");
      setSortDir("asc");
    }
  }, [isIdle]);

  const handleSortClick = (field: "name" | "duration" | "lastScheduled") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const cycleWindowFilter = () => {
    onWindowFilterChange(
      windowFilter === "all" ? "fixed" : windowFilter === "fixed" ? "flexible" : "all",
    );
  };

  const sortedFilteredPatients = useMemo(() => {
    let result = patients;

    if (windowFilter !== "all") {
      result = result.filter((p) => resolveVisitTypeLabel(p) === windowFilter);
    }

    if (sortField === "name") {
      result = [...result].sort((a, b) => {
        const nameA = getPatientDisplayName(a).toLowerCase();
        const nameB = getPatientDisplayName(b).toLowerCase();
        return sortDir === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (sortField === "duration") {
      result = [...result].sort((a, b) =>
        sortDir === "asc"
          ? a.visitDurationMinutes - b.visitDurationMinutes
          : b.visitDurationMinutes - a.visitDurationMinutes,
      );
    } else if (sortField === "lastScheduled") {
      // Never-scheduled (null) sorts as oldest (epoch) → most stale at the top in asc.
      const ts = (p: Patient) => (p.lastScheduledAt ? new Date(p.lastScheduledAt).getTime() : 0);
      result = [...result].sort((a, b) => (sortDir === "asc" ? ts(a) - ts(b) : ts(b) - ts(a)));
    }

    return result;
  }, [patients, sortField, sortDir, windowFilter]);

  const toggleExpanded = (id: string) => {
    setExpandedPatients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!openWindowsPopoverKey) {
      return;
    }

    const close = () => {
      setOpenWindowsPopoverKey(null);
      setWindowsPopoverAnchor(null);
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (windowsTriggerRef.current?.contains(target)) return;
      if (windowsPanelRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    // A fixed-positioned panel would detach from its trigger on scroll/resize,
    // so close rather than continuously reposition.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openWindowsPopoverKey]);

  if (isLoading) {
    return (
      <>
        {/* Mobile skeleton cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={responsiveStyles.mobileClientCard}>
              <div className="h-5 w-2/5 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
              <div className="mt-3 h-4 w-3/5 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
            </div>
          ))}
        </div>
        {/* Desktop skeleton table */}
        <div className={["hidden md:block", responsiveStyles.tableCard].join(" ")}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[23%]" />
                <col className="w-[26%]" />
                <col className="w-28" />
                <col className="w-20" />
                <col className="w-28" />
              </colgroup>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3.5">
                      <div className="h-4 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="h-4 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="h-4 w-24 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-12 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="mx-auto h-4 w-5 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-4 py-3.5" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (patients.length === 0) {
    // First-run: no clients yet on the Active tab → a guided call to action.
    if (!searchQuery.trim() && lifecycleState === "active") {
      return (
        <div className={responsiveStyles.tableEmptyCta}>
          <p className={responsiveStyles.tableEmptyCtaTitle}>Add your first client</p>
          <p className={responsiveStyles.tableEmptyCtaText}>
            Clients are the people you visit. Add them here, then plan an optimized route.
          </p>
          <button
            type="button"
            onClick={onAddClient}
            className={`${responsiveStyles.primaryButton} mt-4 inline-flex w-auto items-center gap-1.5`}
          >
            <span aria-hidden="true">+</span> Add your first client
          </button>
        </div>
      );
    }

    const emptyMessage = searchQuery.trim()
      ? "No clients match this search."
      : lifecycleState === "idle"
        ? "No idle clients — everyone's been used in the last 30 days."
        : "No archived clients in the last 7 days.";
    return <div className={responsiveStyles.tableEmptyState}>{emptyMessage}</div>;
  }

  const windowFilterActive = windowFilter !== "all";

  const visibleIds = sortedFilteredPatients.map((patient) => patient.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const showBulkBar = isIdle && selectedIds.size > 0;
  const bulkCount = selectedIds.size;
  // Name, Address, Window, Duration/Last-scheduled, Actions + optional checkbox + optional Repeat.
  const columnCount = 5 + (isIdle ? 1 : 0) + (showRepeat ? 1 : 0);
  const handleToggleSelectAll = () => {
    if (allSelected) {
      onClearSelection();
    } else {
      onSelectAll(visibleIds);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {sortedFilteredPatients.map((patient) => {
          const windowRows = resolvePatientWindowRows(patient);
          const visitType = resolveVisitTypeLabel(patient);
          const patientDisplayName = getPatientDisplayName(patient);
          const { street, cityRegion } = splitAddress(patient.address);
          const isExpanded = expandedPatients.has(patient.id);
          const isSelected = isIdle && selectedIds.has(patient.id);

          return (
            <article
              key={patient.id}
              className={[
                responsiveStyles.mobileClientCard,
                isSelected
                  ? "border-blue-200 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/30"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                {isIdle && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(patient.id)}
                    onChange={() => onToggleSelect(patient.id)}
                    aria-label={`Select ${patientDisplayName}`}
                    className="h-5 w-5 shrink-0 cursor-pointer rounded accent-blue-600 dark:accent-blue-500"
                  />
                )}
                <button
                  type="button"
                  onClick={() => toggleExpanded(patient.id)}
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded ? `Collapse ${patientDisplayName}` : `Expand ${patientDisplayName}`
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <span className={responsiveStyles.clientAvatar} aria-hidden="true">
                    {getPatientInitials(patient.firstName, patient.lastName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="m-0 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                      {patientDisplayName}
                    </h3>
                    {!isExpanded && (
                      <div className="mt-1 flex items-center gap-2">
                        {renderVisitTypePill(visitType)}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {isIdle
                            ? formatLastScheduled(patient.lastScheduledAt).primary
                            : `${patient.visitDurationMinutes} min`}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronIcon
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${isExpanded ? "rotate-90" : "rotate-0"}`}
                  />
                </button>
              </div>

              {isExpanded && (
                <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div>
                    <p className={responsiveStyles.formGroupEyebrow}>Address</p>
                    <p className="m-0 mt-1 text-sm text-slate-800 dark:text-slate-200">{street}</p>
                    {cityRegion && (
                      <p className="m-0 text-xs text-slate-400 dark:text-slate-500">{cityRegion}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <p className={responsiveStyles.formGroupEyebrow}>Window</p>
                      <div className="mt-1 flex flex-col gap-1.5">
                        {windowRows[0]?.timeLabel === "Not set" ? (
                          <div className="flex items-center gap-1.5">
                            {renderVisitTypePill(visitType)}
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              Not set
                            </span>
                          </div>
                        ) : (
                          windowRows.map((window) => (
                            <div key={window.id} className="flex flex-wrap items-center gap-1.5">
                              {renderVisitTypePill(visitType)}
                              <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                {window.timeLabel}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className={responsiveStyles.formGroupEyebrow}>
                        {isIdle ? "Last scheduled" : "Duration"}
                      </p>
                      <p className="m-0 mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {isIdle
                          ? formatLastScheduled(patient.lastScheduledAt).primary
                          : `${patient.visitDurationMinutes} min`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isArchived ? (
                      <button
                        type="button"
                        onClick={() => onRestore(patient)}
                        disabled={restoringId === patient.id}
                        aria-label={`Restore ${patientDisplayName}`}
                        className={responsiveStyles.mobileEditButton}
                      >
                        <RefreshIcon className="h-4 w-4" />
                        {restoringId === patient.id ? "Restoring…" : "Restore"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(patient)}
                          aria-label={`Edit ${patientDisplayName}`}
                          className={responsiveStyles.mobileEditButton}
                        >
                          <EditIcon className="h-4 w-4" />
                          Edit
                        </button>
                        {lifecycleState === "active" && (
                          <button
                            type="button"
                            onClick={() => void onDelete(patient.id)}
                            disabled={isSubmitting}
                            aria-label={`Archive ${patientDisplayName}`}
                            title="Archive"
                            className={responsiveStyles.mobileDeleteButton}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 dark:divide-slate-800">
            <colgroup>
              {isIdle && <col className="w-12" />}
              <col className="w-[23%]" />
              <col className="w-[23%]" />
              <col className="w-[26%]" />
              <col className="w-28" />
              {showRepeat && <col className="w-20" />}
              <col className="w-28" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
              {showBulkBar ? (
                <tr>
                  <th colSpan={columnCount} className="p-0 font-normal">
                    <div className={responsiveStyles.tableBulkBar}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all idle clients"
                        className={responsiveStyles.tableSelectCheckbox}
                      />
                      <span className={responsiveStyles.tableBulkLabel}>
                        {bulkCount} client{bulkCount === 1 ? "" : "s"} selected
                      </span>
                      <span className={responsiveStyles.tableBulkDivider} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={onClearSelection}
                        className={responsiveStyles.tableBulkClear}
                      >
                        Clear
                      </button>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={onArchiveSelected}
                        disabled={isBulkArchiving}
                        className={responsiveStyles.tableBulkArchiveButton}
                      >
                        <ArchiveIcon className="h-4 w-4" />
                        {isBulkArchiving
                          ? "Archiving…"
                          : `Archive ${bulkCount} client${bulkCount === 1 ? "" : "s"}`}
                      </button>
                    </div>
                  </th>
                </tr>
              ) : (
                <tr>
                  {isIdle && (
                    <th className="w-12 px-5 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all idle clients"
                        className={responsiveStyles.tableSelectCheckbox}
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => handleSortClick("name")}
                      className={[
                        responsiveStyles.tableSortButtonBase,
                        sortField === "name"
                          ? responsiveStyles.tableSortButtonActive
                          : responsiveStyles.tableSortButtonInactive,
                      ].join(" ")}
                    >
                      Name
                      <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      type="button"
                      onClick={cycleWindowFilter}
                      className={[
                        responsiveStyles.tableSortButtonFilterBase,
                        windowFilterActive
                          ? responsiveStyles.tableSortButtonActive
                          : responsiveStyles.tableSortButtonInactive,
                      ].join(" ")}
                    >
                      Window
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 opacity-85"
                      >
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => handleSortClick(isIdle ? "lastScheduled" : "duration")}
                      className={[
                        responsiveStyles.tableSortButtonBase,
                        sortField === (isIdle ? "lastScheduled" : "duration")
                          ? responsiveStyles.tableSortButtonActive
                          : responsiveStyles.tableSortButtonInactive,
                      ].join(" ")}
                    >
                      {isIdle ? "Last scheduled" : "Duration"}
                      <SortIcon
                        field={isIdle ? "lastScheduled" : "duration"}
                        sortField={sortField}
                        sortDir={sortDir}
                      />
                    </button>
                  </th>
                  {showRepeat && (
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      Repeat
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sortedFilteredPatients.length === 0 && (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No clients match the current filter.
                  </td>
                </tr>
              )}
              {sortedFilteredPatients.map((patient) => {
                const windowRows = resolvePatientWindowRows(patient);
                const visitType = resolveVisitTypeLabel(patient);
                const patientDisplayName = getPatientDisplayName(patient);
                const activeRecurringCount = countActiveRecurringTemplates(
                  recurringTemplatesByPatientId.get(patient.id),
                );
                const isSelected = isIdle && selectedIds.has(patient.id);
                return (
                  <tr
                    key={patient.id}
                    className={[
                      responsiveStyles.tableRow,
                      isSelected ? responsiveStyles.tableRowSelected : "",
                    ].join(" ")}
                  >
                    {isIdle && (
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(patient.id)}
                          onChange={() => onToggleSelect(patient.id)}
                          aria-label={`Select ${patientDisplayName}`}
                          className={responsiveStyles.tableSelectCheckbox}
                        />
                      </td>
                    )}
                    <td className="px-6 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={responsiveStyles.clientAvatar} aria-hidden="true">
                          {getPatientInitials(patient.firstName, patient.lastName)}
                        </span>
                        <p
                          title={patientDisplayName}
                          className="m-0 min-w-0 line-clamp-2 text-sm font-bold text-slate-900 dark:text-slate-100"
                        >
                          {patientDisplayName}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {(() => {
                        const { street, cityRegion } = splitAddress(patient.address);
                        return (
                          <>
                            <p
                              title={patient.address}
                              className="m-0 truncate text-sm text-slate-800 dark:text-slate-200"
                            >
                              {street}
                            </p>
                            {cityRegion && (
                              <p className="m-0 truncate text-xs text-slate-400 dark:text-slate-500">
                                {cityRegion}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {renderVisitTypePill(visitType)}
                        {windowRows[0]?.timeLabel !== "Not set" && (
                          <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                            {windowRows[0]?.timeLabel}
                          </span>
                        )}
                      </div>
                      {windowRows.length > 1 && (
                        <div
                          className="relative mt-0.5"
                          ref={openWindowsPopoverKey === patient.id ? windowsTriggerRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              if (openWindowsPopoverKey === patient.id) {
                                setOpenWindowsPopoverKey(null);
                                setWindowsPopoverAnchor(null);
                                return;
                              }
                              const rect = event.currentTarget.getBoundingClientRect();
                              setWindowsPopoverAnchor({
                                top: rect.bottom,
                                left: rect.left,
                                right: rect.right,
                              });
                              setOpenWindowsPopoverKey(patient.id);
                            }}
                            className="text-xs font-medium text-blue-600 underline underline-offset-2 cursor-pointer dark:text-blue-400"
                          >
                            +{windowRows.length - 1} more
                          </button>
                          {openWindowsPopoverKey === patient.id &&
                            windowsPopoverAnchor &&
                            createPortal(
                              <div
                                ref={windowsPanelRef}
                                style={{
                                  position: "fixed",
                                  top: windowsPopoverAnchor.top + 4,
                                  // Right-anchor when the trigger is in the right
                                  // ~40% of the viewport so the panel never runs off-screen.
                                  ...(windowsPopoverAnchor.left > window.innerWidth * 0.6
                                    ? { right: window.innerWidth - windowsPopoverAnchor.right }
                                    : { left: windowsPopoverAnchor.left }),
                                }}
                                className="z-50 w-max max-w-[min(16rem,90vw)] rounded-xl border border-slate-200 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-900"
                              >
                                {windowRows.slice(1).map((row) => (
                                  <div key={row.id} className="px-1 py-1">
                                    <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                                      {row.timeLabel}
                                    </span>
                                  </div>
                                ))}
                              </div>,
                              document.body,
                            )}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-left text-sm text-slate-600 dark:text-slate-300">
                      {isIdle ? (
                        (() => {
                          const { primary, secondary } = formatLastScheduled(
                            patient.lastScheduledAt,
                          );
                          return (
                            <div className="min-w-0">
                              <p className="m-0 text-sm text-slate-700 dark:text-slate-300">
                                {primary}
                              </p>
                              {secondary && (
                                <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                                  {secondary}
                                </p>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {patient.visitDurationMinutes} min
                        </span>
                      )}
                    </td>
                    {showRepeat && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center">
                          {activeRecurringCount > 0 ? (
                            <span
                              className="relative inline-flex"
                              aria-label={`${activeRecurringCount} active recurring ${
                                activeRecurringCount === 1 ? "template" : "templates"
                              }`}
                              title={`${activeRecurringCount} active recurring ${
                                activeRecurringCount === 1 ? "template" : "templates"
                              }`}
                            >
                              <CalendarIcon className={responsiveStyles.repeatIconActive} />
                              <span className={responsiveStyles.repeatCountBadge}>
                                {activeRecurringCount}
                              </span>
                            </span>
                          ) : (
                            <CalendarIcon
                              className={responsiveStyles.repeatIconMuted}
                              aria-label="No recurring templates"
                            />
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => onRestore(patient)}
                            disabled={restoringId === patient.id}
                            aria-label={`Restore ${patientDisplayName}`}
                            className={responsiveStyles.restoreButton}
                          >
                            <RefreshIcon className="h-3.5 w-3.5" />
                            {restoringId === patient.id ? "Restoring…" : "Restore"}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(patient)}
                              aria-label={`Edit ${patientDisplayName}`}
                              title="Edit"
                              className={responsiveStyles.tableIconButton}
                            >
                              <EditIcon className="h-3.5 w-3.5" />
                            </button>
                            {lifecycleState === "active" && (
                              <button
                                type="button"
                                onClick={() => void onDelete(patient.id)}
                                disabled={isSubmitting}
                                aria-label={`Archive ${patientDisplayName}`}
                                title="Archive"
                                className={responsiveStyles.tableIconButtonDestructive}
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
