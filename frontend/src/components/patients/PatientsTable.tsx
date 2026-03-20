import { useEffect, useMemo, useRef, useState } from "react";
import type { Patient } from "../../../../shared/contracts";
import { getPatientDisplayName, toTimeInput } from "./patientForm";

type SortField = "name" | "duration" | null;
type SortDir = "asc" | "desc";
type WindowFilter = "all" | "fixed" | "flexible";

type PatientsTableProps = {
  isLoading: boolean;
  isSubmitting: boolean;
  patients: Patient[];
  searchQuery: string;
  onDelete: (patientId: string) => Promise<void> | void;
  onEdit: (patient: Patient) => void;
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

type PatientWindowRow = {
  id: string;
  timeLabel: string;
};

const formatWindowRange = (startTime: string, endTime: string) =>
  `${toTimeInput(startTime)}\u00A0-\u00A0${toTimeInput(endTime)}`;

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
      timeLabel: formatWindowRange(
        patient.preferredVisitStartTime,
        patient.preferredVisitEndTime,
      ),
    },
  ];
};

const resolveVisitTypeLabel = (patient: Patient): "fixed" | "flexible" | "mixed" => {
  const windows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
  if (windows.length === 0) {
    return patient.visitTimeType === "flexible" ? "flexible" : "fixed";
  }

  const visitTypes = new Set(windows.map((window) => window.visitTimeType));
  if (visitTypes.size > 1) {
    return "mixed";
  }

  return visitTypes.has("flexible") ? "flexible" : "fixed";
};

const renderVisitTypePill = (visitType: "fixed" | "flexible" | "mixed") => {
  const typeClassName =
    visitType === "fixed"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
      : visitType === "flexible"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200";

  return (
    <span
      className={[
        "inline-flex w-fit justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        typeClassName,
      ].join(" ")}
    >
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

const SortIcon = ({ field, sortField, sortDir }: { field: "name" | "duration"; sortField: SortField; sortDir: SortDir }) => {
  if (sortField !== field) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5 opacity-85">
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }
  return sortDir === "asc" ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M12 19V5" />
      <path d="M7 10l5-5 5 5" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
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
  onDelete,
  onEdit,
}: PatientsTableProps) => {
  const [openActionsMenuKey, setOpenActionsMenuKey] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(() => new Set());
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all");

  const handleSortClick = (field: "name" | "duration") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const cycleWindowFilter = () => {
    setWindowFilter((f) => (f === "all" ? "fixed" : f === "fixed" ? "flexible" : "all"));
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

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading patients...
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {searchQuery.trim() ? "No patients match this search." : "No patients added yet."}
      </div>
    );
  }

  const windowFilterActive = windowFilter !== "all";
  const windowFilterLabel = windowFilter === "fixed" ? "Fixed" : windowFilter === "flexible" ? "Flexible" : null;

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {sortedFilteredPatients.map((patient, index) => {
          const windowRows = resolvePatientWindowRows(patient);
          const visitType = resolveVisitTypeLabel(patient);
          const patientDisplayName = getPatientDisplayName(patient);
          const mobileMenuKey = `mobile:${patient.id}`;
          const isMobileMenuOpen = openActionsMenuKey === mobileMenuKey;

          const isExpanded = expandedPatients.has(patient.id);

          return (
            <article
              key={patient.id}
              className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                No. {index + 1}
              </p>

              <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-x-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(patient.id)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Collapse ${patientDisplayName}` : `Expand ${patientDisplayName}`}
                  className="-mx-1 flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-left transition active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <ChevronIcon className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${isExpanded ? "rotate-90" : "rotate-0"}`} />
                  <h3 className="m-0 min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {patientDisplayName}
                  </h3>
                </button>

                <div
                  ref={isMobileMenuOpen ? actionsMenuRef : undefined}
                  className="relative"
                >
                  <button
                    type="button"
                    aria-label={`Open actions for ${patientDisplayName}`}
                    title={`Open actions for ${patientDisplayName}`}
                    onClick={() =>
                      setOpenActionsMenuKey((current) =>
                        current === mobileMenuKey ? null : mobileMenuKey,
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <MoreActionsIcon className="h-4 w-4" />
                  </button>
                  {isMobileMenuOpen && (
                    <div className="absolute right-0 z-20 mt-1 min-w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionsMenuKey(null);
                          onEdit(patient);
                        }}
                        aria-label={`Edit patient ${patientDisplayName}`}
                        className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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
                        aria-label={`Delete patient ${patientDisplayName}`}
                        className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30"
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
                    <dd className="m-0 text-slate-600 dark:text-slate-400">{patient.address}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div>
                      <dt className="font-semibold text-slate-700 dark:text-slate-300">Time windows</dt>
                      <dd className="m-0 grid gap-1.5 text-slate-600 dark:text-slate-400">
                        {windowRows.map((window) => (
                          <div key={window.id} className="whitespace-nowrap">
                            {window.timeLabel}
                          </div>
                        ))}
                        {renderVisitTypePill(visitType)}
                      </dd>
                    </div>
                    <div className="text-right">
                      <dt className="font-semibold text-slate-700 dark:text-slate-300">Visit duration</dt>
                      <dd className="m-0 text-slate-600 dark:text-slate-400">
                        {patient.visitDurationMinutes} min
                      </dd>
                    </div>
                  </div>
                </dl>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <colgroup>
              <col className="w-24" />
              <col className="w-[31%]" />
              <col className="w-[47%]" />
              <col className="w-[17%]" />
              <col className="w-16" />
              <col className="w-14" />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  No.
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    type="button"
                    onClick={() => handleSortClick("name")}
                    className={[
                      "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-slate-700 dark:hover:text-slate-200",
                      sortField === "name" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
                    ].join(" ")}
                  >
                    Name
                    <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Address
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    type="button"
                    onClick={cycleWindowFilter}
                    className={[
                      "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-slate-700 dark:hover:text-slate-200",
                      windowFilterActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
                    ].join(" ")}
                  >
                    Preferred window
                    {windowFilterLabel ? (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {windowFilterLabel}
                      </span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5 opacity-85">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-3 py-4 text-left">
                  <button
                    type="button"
                    onClick={() => handleSortClick("duration")}
                    className={[
                      "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-slate-700 dark:hover:text-slate-200",
                      sortField === "duration" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
                    ].join(" ")}
                  >
                    Duration
                    <SortIcon field="duration" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-3 py-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sortedFilteredPatients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No patients match the current filter.
                  </td>
                </tr>
              )}
              {sortedFilteredPatients.map((patient, index) => {
                const windowRows = resolvePatientWindowRows(patient);
                const visitType = resolveVisitTypeLabel(patient);
                const patientDisplayName = getPatientDisplayName(patient);
                const desktopMenuKey = `desktop:${patient.id}`;
                const isMenuOpen = openActionsMenuKey === desktopMenuKey;

                return (
                  <tr
                    key={patient.id}
                    className="transition hover:bg-slate-50 dark:hover:bg-slate-950"
                  >
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {patientDisplayName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {patient.address}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <div className="grid gap-1.5">
                        {renderVisitTypePill(visitType)}
                        {windowRows.map((window) => (
                          <div key={window.id} className="whitespace-nowrap">
                            {window.timeLabel}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {patient.visitDurationMinutes} min
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <div
                          ref={isMenuOpen ? actionsMenuRef : undefined}
                          className="relative"
                        >
                          <button
                            type="button"
                            aria-label={`Open actions for ${patientDisplayName}`}
                            title={`Open actions for ${patientDisplayName}`}
                            onClick={() =>
                              setOpenActionsMenuKey((current) =>
                                current === desktopMenuKey ? null : desktopMenuKey,
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <MoreActionsIcon className="h-3.5 w-3.5" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 z-20 mt-1 min-w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuKey(null);
                                  onEdit(patient);
                                }}
                                aria-label={`Edit patient ${patientDisplayName}`}
                                className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                aria-label={`Delete patient ${patientDisplayName}`}
                                className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
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
