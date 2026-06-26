import { useEffect, useMemo, useRef, useState } from "react";
import type { Patient, RecurringVisitTemplate } from "../../../../../shared/contracts";
import { getPatientDisplayName, toTimeInput } from "../domain/patientForm";
import { getPatientInitials } from "../domain/patientName";
import { resolveVisitTypeLabel, type WindowFilter } from "../domain/visitType";
import { countActiveRecurringTemplates } from "../domain/recurringTemplate";
import { responsiveStyles } from "../../../components/responsiveStyles";

type SortField = "name" | "duration" | null;
type SortDir = "asc" | "desc";

type PatientsTableProps = {
  isLoading: boolean;
  isSubmitting: boolean;
  patients: Patient[];
  searchQuery: string;
  windowFilter: WindowFilter;
  onWindowFilterChange: (windowFilter: WindowFilter) => void;
  onDelete: (patientId: string) => Promise<void> | void;
  onEdit: (patient: Patient) => void;
  recurringTemplatesByPatientId: Map<string, RecurringVisitTemplate[]>;
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

const MoreActionsIcon = ({ className }: { className?: string }) => (
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
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
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

const formatRecurringSummary = (templates: RecurringVisitTemplate[] | undefined) => {
  if (!templates || templates.length === 0) {
    return "No recurring templates configured yet.";
  }

  const activeCount = templates.filter((template) => template.isActive).length;
  if (activeCount === 0) {
    return "All recurring templates are paused.";
  }

  const templateLabel = activeCount === 1 ? "recurring template" : "recurring templates";
  return `${activeCount} active ${templateLabel}`;
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
  field: "name" | "duration";
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
  searchQuery,
  windowFilter,
  onWindowFilterChange,
  onDelete,
  onEdit,
  recurringTemplatesByPatientId,
}: PatientsTableProps) => {
  const [openActionsMenuKey, setOpenActionsMenuKey] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [openWindowsPopoverKey, setOpenWindowsPopoverKey] = useState<string | null>(null);
  const windowsPopoverRef = useRef<HTMLDivElement | null>(null);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(() => new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSortClick = (field: "name" | "duration") => {
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
    if (!openActionsMenuKey) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) {
        setOpenActionsMenuKey(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionsMenuKey(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openActionsMenuKey]);

  useEffect(() => {
    if (!openActionsMenuKey) {
      return;
    }

    const patientId = openActionsMenuKey.split(":")[1];
    const hasOpenMenuPatient = patients.some((patient) => patient.id === patientId);
    if (!hasOpenMenuPatient) {
      setOpenActionsMenuKey(null);
    }
  }, [openActionsMenuKey, patients]);

  useEffect(() => {
    if (!openWindowsPopoverKey) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!windowsPopoverRef.current?.contains(event.target as Node)) {
        setOpenWindowsPopoverKey(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenWindowsPopoverKey(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openWindowsPopoverKey]);

  if (isLoading) {
    return (
      <>
        {/* Mobile skeleton cards */}
        <div className="grid gap-3 md:hidden">
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
                <col className="w-[28%]" />
                <col className="w-[34%]" />
                <col className="w-[18%]" />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-20" />
              </colgroup>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-5">
                      <div className="h-4 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 w-24 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-4 py-5">
                      <div className="h-4 w-12 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-4 py-5">
                      <div className="mx-auto h-4 w-5 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
                    </td>
                    <td className="px-4 py-5" />
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
    return (
      <div className={responsiveStyles.tableEmptyState}>
        {searchQuery.trim() ? "No clients match this search." : "No clients added yet."}
      </div>
    );
  }

  const windowFilterActive = windowFilter !== "all";
  const windowFilterLabel =
    windowFilter === "fixed" ? "Fixed" : windowFilter === "flexible" ? "Flexible" : null;

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {sortedFilteredPatients.map((patient) => {
          const windowRows = resolvePatientWindowRows(patient);
          const visitType = resolveVisitTypeLabel(patient);
          const patientDisplayName = getPatientDisplayName(patient);
          const mobileMenuKey = `mobile:${patient.id}`;
          const isMobileMenuOpen = openActionsMenuKey === mobileMenuKey;
          const recurringSummary = formatRecurringSummary(
            recurringTemplatesByPatientId.get(patient.id),
          );

          const isExpanded = expandedPatients.has(patient.id);

          return (
            <article key={patient.id} className={responsiveStyles.mobileClientCard}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(patient.id)}
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded ? `Collapse ${patientDisplayName}` : `Expand ${patientDisplayName}`
                  }
                  className="-mx-1 flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-left transition active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <ChevronIcon
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${isExpanded ? "rotate-90" : "rotate-0"}`}
                  />
                  <h3 className="m-0 min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {patientDisplayName}
                  </h3>
                </button>

                <div ref={isMobileMenuOpen ? actionsMenuRef : undefined} className="relative">
                  <button
                    type="button"
                    aria-label={`Open actions for ${patientDisplayName}`}
                    title={`Open actions for ${patientDisplayName}`}
                    onClick={() =>
                      setOpenActionsMenuKey((current) =>
                        current === mobileMenuKey ? null : mobileMenuKey,
                      )
                    }
                    className={responsiveStyles.mobileActionButton}
                  >
                    <MoreActionsIcon className="h-4 w-4" />
                  </button>
                  {isMobileMenuOpen && (
                    <div className={responsiveStyles.dropdownMenu}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionsMenuKey(null);
                          onEdit(patient);
                        }}
                        aria-label={`Edit client ${patientDisplayName}`}
                        className={responsiveStyles.dropdownMenuItem}
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionsMenuKey(null);
                          void onDelete(patient.id);
                        }}
                        disabled={isSubmitting}
                        aria-label={`Delete client ${patientDisplayName}`}
                        className={responsiveStyles.dropdownMenuItemDestructive}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <dl className="mt-2 grid gap-2 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-700 dark:text-slate-300">Address</dt>
                    <dd className="m-0">
                      {(() => {
                        const { street, cityRegion } = splitAddress(patient.address);
                        return (
                          <>
                            <p className="m-0 text-sm text-slate-700 dark:text-slate-300">
                              {street}
                            </p>
                            {cityRegion && (
                              <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                                {cityRegion}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div>
                      <dt className="font-semibold text-slate-700 dark:text-slate-300">
                        Time windows
                      </dt>
                      <dd className="m-0 grid gap-1.5">
                        {windowRows[0]?.timeLabel === "Not set" ? (
                          <div className="flex items-center gap-1.5">
                            {renderVisitTypePill(visitType)}
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              Not set
                            </span>
                          </div>
                        ) : (
                          windowRows.map((window) => (
                            <div key={window.id} className="flex items-center gap-1.5">
                              {renderVisitTypePill(visitType)}
                              <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                {window.timeLabel}
                              </span>
                            </div>
                          ))
                        )}
                      </dd>
                    </div>
                    <div className="text-right">
                      <dt className="font-semibold text-slate-700 dark:text-slate-300">
                        Visit duration
                      </dt>
                      <dd className="m-0 text-slate-600 dark:text-slate-400">
                        {patient.visitDurationMinutes} min
                      </dd>
                      <dt className={`mt-2 ${responsiveStyles.recurrenceLabel}`}>Recurrence</dt>
                      <dd className={responsiveStyles.recurrenceValue}>{recurringSummary}</dd>
                    </div>
                  </div>
                </dl>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-20" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
              <tr>
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
                    {windowFilterLabel ? (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {windowFilterLabel}
                      </span>
                    ) : (
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
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => handleSortClick("duration")}
                    className={[
                      responsiveStyles.tableSortButtonBase,
                      sortField === "duration"
                        ? responsiveStyles.tableSortButtonActive
                        : responsiveStyles.tableSortButtonInactive,
                    ].join(" ")}
                  >
                    Duration
                    <SortIcon field="duration" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                  Repeat
                </th>
                <th className="px-4 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sortedFilteredPatients.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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
                return (
                  <tr key={patient.id} className={responsiveStyles.tableRow}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className={responsiveStyles.clientAvatar} aria-hidden="true">
                          {getPatientInitials(patient.firstName, patient.lastName)}
                        </span>
                        <p className="m-0 line-clamp-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                          {patientDisplayName}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {(() => {
                        const { street, cityRegion } = splitAddress(patient.address);
                        return (
                          <>
                            <p className="m-0 text-sm text-slate-800 dark:text-slate-200">
                              {street}
                            </p>
                            {cityRegion && (
                              <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                                {cityRegion}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-5">
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
                          ref={openWindowsPopoverKey === patient.id ? windowsPopoverRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenWindowsPopoverKey((current) =>
                                current === patient.id ? null : patient.id,
                              )
                            }
                            className="text-xs font-medium text-blue-600 underline underline-offset-2 cursor-pointer dark:text-blue-400"
                          >
                            +{windowRows.length - 1} more
                          </button>
                          {openWindowsPopoverKey === patient.id && (
                            <div className="absolute left-0 top-full z-20 mt-1 min-w-max rounded-xl border border-slate-200 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-900">
                              {windowRows.slice(1).map((row) => (
                                <div key={row.id} className="px-1 py-1">
                                  <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                                    {row.timeLabel}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-5 text-left text-sm text-slate-600 dark:text-slate-300">
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
                    </td>
                    <td className="px-4 py-5">
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
                    <td className="px-4 py-5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => onEdit(patient)}
                          aria-label={`Edit ${patientDisplayName}`}
                          title="Edit"
                          className={responsiveStyles.tableIconButton}
                        >
                          <EditIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(patient.id)}
                          disabled={isSubmitting}
                          aria-label={`Delete ${patientDisplayName}`}
                          title="Delete"
                          className={responsiveStyles.tableIconButtonDestructive}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
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
