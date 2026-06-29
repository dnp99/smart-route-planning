import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import { responsiveStyles } from "../../../components/responsiveStyles";
import ConfirmDialog from "../../../components/modals/ConfirmDialog";
import type {
  Patient,
  RecurringVisitTemplate,
  VisitTimeType,
} from "../../../../../shared/contracts";
import { PatientFormModal } from "./PatientFormModal";
import { PatientsTable } from "./PatientsTable";
import {
  EMPTY_FORM,
  buildRecurringTemplateMutationPlan,
  createEmptyRecurringTemplate,
  createEmptyVisitWindow,
  type FormFieldErrors,
  type FormMode,
  type PatientFormRecurringTemplate,
  type PatientFormValues,
  type PatientFormVisitWindow,
  toCreateRequest,
  toFormValues,
  validateForm,
} from "../domain/patientForm";
import { useClientStats } from "../hooks/useClientStats";
import type { WindowFilter } from "../domain/visitType";
import {
  archiveClients,
  createPatient,
  deletePatient,
  fetchPatientCounts,
  listPatients,
  restoreClient,
  updatePatient,
  type PatientCounts,
  type PatientLifecycleState,
} from "../api/patientService";
import {
  createRecurringVisitTemplate,
  deleteRecurringVisitTemplate,
  listRecurringVisitTemplates,
  updateRecurringVisitTemplate,
} from "../api/recurringVisitTemplateService";

// On-demand helper text per lifecycle tab, surfaced via the (i) popover.
const TAB_INFO_TEXT: Record<PatientLifecycleState, string> = {
  active:
    "Clients you’re actively scheduling visits for. Edit anyone’s details, or archive clients you no longer see.",
  idle: "No visits scheduled in the last 30 days. Select any clients you no longer need and archive them to keep your active list clean.",
  archived: "Archived clients stay here for 7 days. Restore one to move it back to Active.",
};

const PlusIcon = ({ className }: { className?: string }) => (
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
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const PatientsPage = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const clientStats = useClientStats(patients);
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<PatientFormValues>(EMPTY_FORM);
  const [initialFormValues, setInitialFormValues] = useState<PatientFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recurringTemplatesByPatientId, setRecurringTemplatesByPatientId] = useState<
    Map<string, RecurringVisitTemplate[]>
  >(new Map());
  const [templateFilterMode, setTemplateFilterMode] = useState<string | null>(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    return new URLSearchParams(search).get("templateFilter");
  });
  const hasTemplateFilter = templateFilterMode === "without" || templateFilterMode === "with";

  const [lifecycleState, setLifecycleState] = useState<PatientLifecycleState>(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const value = new URLSearchParams(search).get("state");
    return value === "idle" || value === "archived" ? value : "active";
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [counts, setCounts] = useState<PatientCounts | null>(null);
  const [showTabInfo, setShowTabInfo] = useState(false);
  const tabInfoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showTabInfo) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!tabInfoRef.current?.contains(event.target as Node)) setShowTabInfo(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowTabInfo(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showTabInfo]);

  const changeLifecycleState = (next: PatientLifecycleState) => {
    if (next === lifecycleState) return;
    setLifecycleState(next);
    setSelectedIds(new Set());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (next === "active") {
        params.delete("state");
      } else {
        params.set("state", next);
      }
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  };

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );
  const selectedVisitType: VisitTimeType = formValues.visitWindows[0]?.visitTimeType ?? "flexible";

  const fetchPatients = async (query: string) => {
    setIsLoadingPatients(true);
    setPageError("");

    try {
      const [nextPatients, recurringTemplates, nextCounts] = await Promise.all([
        listPatients(query, lifecycleState),
        listRecurringVisitTemplates(),
        fetchPatientCounts().catch(() => ({ active: 0, idle: 0, archived: 0 })),
      ]);
      setCounts(nextCounts);
      const nextRecurringTemplatesByPatientId = new Map<string, RecurringVisitTemplate[]>();
      recurringTemplates.forEach((template) => {
        const current = nextRecurringTemplatesByPatientId.get(template.patientId) ?? [];
        current.push(template);
        nextRecurringTemplatesByPatientId.set(template.patientId, current);
      });
      const patientsFilteredByTemplate = nextPatients.filter((patient) => {
        if (!hasTemplateFilter) {
          return true;
        }

        const activeTemplateCount =
          nextRecurringTemplatesByPatientId.get(patient.id)?.filter((template) => template.isActive)
            .length ?? 0;

        if (templateFilterMode === "without") {
          return activeTemplateCount === 0;
        }

        return activeTemplateCount > 0;
      });
      setPatients(patientsFilteredByTemplate);
      setRecurringTemplatesByPatientId(nextRecurringTemplatesByPatientId);

      if (selectedPatientId && !nextPatients.some((patient) => patient.id === selectedPatientId)) {
        setSelectedPatientId(null);
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load clients.");
    } finally {
      setIsLoadingPatients(false);
    }
  };

  useEffect(() => {
    void fetchPatients(searchQuery);
  }, [hasTemplateFilter, searchQuery, templateFilterMode, lifecycleState]);

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectAll = (ids: string[]) => setSelectedIds(new Set(ids));

  const handleArchiveSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsBulkArchiving(true);
    setPageError("");
    try {
      await archiveClients(ids);
      setSelectedIds(new Set());
      await fetchPatients(searchQuery);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to archive clients.");
    } finally {
      setIsBulkArchiving(false);
    }
  };

  const handleRestore = async (patient: Patient) => {
    setRestoringId(patient.id);
    setPageError("");
    try {
      await restoreClient(patient.id);
      await fetchPatients(searchQuery);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to restore client.");
    } finally {
      setRestoringId(null);
    }
  };

  const isDirty = useMemo(
    () => JSON.stringify(formValues) !== JSON.stringify(initialFormValues),
    [formValues, initialFormValues],
  );

  const resetFormState = () => {
    setSelectedPatientId(null);
    setFormMode("create");
    setFormValues(EMPTY_FORM);
    setInitialFormValues(EMPTY_FORM);
    setFormErrors({});
  };

  const closeModal = () => {
    resetFormState();
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    resetFormState();
    setPageError("");
    setIsModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setFormMode("edit");
    const values = toFormValues(patient, recurringTemplatesByPatientId.get(patient.id) ?? []);
    setFormValues(values);
    setInitialFormValues(values);
    setFormErrors({});
    setPageError("");
    setIsModalOpen(true);
  };

  const handleFieldChange = <K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K],
  ) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleVisitWindowChange = <K extends keyof PatientFormVisitWindow>(
    windowId: string,
    field: K,
    value: PatientFormVisitWindow[K],
  ) => {
    setFormValues((current) => ({
      ...current,
      visitWindows: current.visitWindows.map((window) =>
        window.id === windowId ? { ...window, [field]: value } : window,
      ),
    }));
    setFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleAddVisitWindow = () => {
    setFormValues((current) => ({
      ...current,
      visitWindows: [
        ...current.visitWindows,
        createEmptyVisitWindow(
          current.visitWindows[0]?.visitTimeType ?? "flexible",
          current.visitWindows.length,
        ),
      ],
    }));
    setFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleRemoveVisitWindow = (windowId: string) => {
    setFormValues((current) => ({
      ...current,
      visitWindows: current.visitWindows.filter((window) => window.id !== windowId),
    }));
    setFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleRecurringTemplateChange = <K extends keyof PatientFormRecurringTemplate>(
    templateId: string,
    field: K,
    value: PatientFormRecurringTemplate[K],
  ) => {
    setFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.map((template) =>
        template.id === templateId ? { ...template, [field]: value } : template,
      ),
    }));
    setFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleAddRecurringTemplate = () => {
    setFormValues((current) => ({
      ...current,
      recurringTemplates: [...current.recurringTemplates, createEmptyRecurringTemplate()],
    }));
    setFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleRemoveRecurringTemplate = (templateId: string) => {
    setFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.filter(
        (template) => template.id !== templateId,
      ),
    }));
    setFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const syncRecurringTemplatesForPatient = async (
    patientId: string,
    values: PatientFormValues,
    existingTemplates: RecurringVisitTemplate[],
  ) => {
    const mutationPlan = buildRecurringTemplateMutationPlan(patientId, values, existingTemplates);

    await Promise.all(
      mutationPlan.remove.map((templateId) => deleteRecurringVisitTemplate(templateId)),
    );

    const created = await Promise.all(
      mutationPlan.create.map((request) => createRecurringVisitTemplate(request)),
    );

    const updated = await Promise.all(
      mutationPlan.update.map(({ templateId, request }) =>
        updateRecurringVisitTemplate(templateId, request),
      ),
    );

    return [...created, ...updated];
  };

  const handleVisitTypeChange = (visitTimeType: VisitTimeType) => {
    setFormValues((current) => {
      if (visitTimeType === "flexible") {
        return {
          ...current,
          visitWindows: [],
        };
      }

      if (current.visitWindows.length === 0) {
        return {
          ...current,
          visitWindows: [createEmptyVisitWindow("fixed", 0)],
        };
      }

      return {
        ...current,
        visitWindows: current.visitWindows.map((window) => ({
          ...window,
          visitTimeType,
        })),
      };
    });
    setFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleAddressChange = (value: string) => {
    setFormValues((current) => ({
      ...current,
      address: value,
      googlePlaceId: null,
    }));
    setFormErrors((current) => ({ ...current, address: undefined }));
  };

  const handleAddressPick = (suggestion: AddressSuggestion) => {
    setFormValues((current) => ({
      ...current,
      address: suggestion.displayName,
      googlePlaceId: suggestion.placeId,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setPageError("");

    try {
      if (formMode === "create") {
        const createdPatient = await createPatient(toCreateRequest(formValues));
        await syncRecurringTemplatesForPatient(createdPatient.id, formValues, []);
        closeModal();
        setSearchQuery("");
        await fetchPatients("");
        return;
      }

      if (!selectedPatientId) {
        setPageError("Please select a client to edit.");
        return;
      }

      const updated = await updatePatient(selectedPatientId, toCreateRequest(formValues));
      await syncRecurringTemplatesForPatient(
        selectedPatientId,
        formValues,
        recurringTemplatesByPatientId.get(selectedPatientId) ?? [],
      );
      setSelectedPatientId(updated.id);
      setFormMode("edit");
      setFormValues(toFormValues(updated, recurringTemplatesByPatientId.get(updated.id) ?? []));
      await fetchPatients(searchQuery);
      setIsModalOpen(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (patientId: string) => {
    setPendingDeleteId(patientId);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setIsDeletingPatient(true);
    setPageError("");
    try {
      await deletePatient(pendingDeleteId);
      if (selectedPatientId === pendingDeleteId) {
        closeModal();
      }
      await fetchPatients(searchQuery);
      setPendingDeleteId(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to delete client.");
      setPendingDeleteId(null);
    } finally {
      setIsDeletingPatient(false);
    }
  };

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        {/* No page title on either figma — the nav "Clients" + tab counts serve as it. */}
        {hasTemplateFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span className="font-medium">
              Filter:{" "}
              {templateFilterMode === "without"
                ? "Clients without active templates"
                : "Clients with active templates"}
            </span>
            <button
              type="button"
              onClick={() => {
                const nextParams = new URLSearchParams(window.location.search);
                nextParams.delete("templateFilter");
                const nextSearch = nextParams.toString();
                window.history.replaceState(
                  {},
                  "",
                  `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
                );
                setTemplateFilterMode(null);
              }}
              className="rounded-md border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900/40"
            >
              Clear filter
            </button>
          </div>
        )}

        {pageError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {pageError}
          </p>
        )}

        <div className={responsiveStyles.clientTabsRow}>
          <div
            className={responsiveStyles.clientStateTabBar}
            role="tablist"
            aria-label="Client status"
          >
            {(
              [
                { key: "active", label: "Active" },
                { key: "idle", label: "Idle" },
                { key: "archived", label: "Archived" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={lifecycleState === tab.key}
                onClick={() => changeLifecycleState(tab.key)}
                className={`${responsiveStyles.clientStateTab} ${
                  lifecycleState === tab.key
                    ? responsiveStyles.clientStateTabActive
                    : responsiveStyles.clientStateTabInactive
                }`}
              >
                {tab.label}
                {counts && (
                  <>
                    {" "}
                    <span
                      className={
                        lifecycleState === tab.key
                          ? "font-semibold text-blue-300 dark:text-blue-400/70"
                          : "font-semibold text-slate-300 dark:text-slate-600"
                      }
                    >
                      ({counts[tab.key]})
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
          <div className="relative ml-auto flex items-center self-stretch pl-2" ref={tabInfoRef}>
            <button
              type="button"
              onClick={() => setShowTabInfo((value) => !value)}
              aria-label={`About the ${lifecycleState} tab`}
              aria-expanded={showTabInfo}
              className={responsiveStyles.clientTabInfoButton}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
            {showTabInfo && (
              <div role="tooltip" className={responsiveStyles.clientTabInfoPopover}>
                {TAB_INFO_TEXT[lifecycleState]}
              </div>
            )}
          </div>
        </div>

        {lifecycleState === "active" && (
          <div className={responsiveStyles.clientStatsStrip} data-testid="client-stats">
            <span>
              <span className={responsiveStyles.clientStatsStripValue}>{clientStats.total}</span>{" "}
              client{clientStats.total === 1 ? "" : "s"}
            </span>
            <span className={responsiveStyles.clientStatsStripDot} aria-hidden="true" />
            <span>
              <span className={responsiveStyles.clientStatsStripValueFixed}>
                {clientStats.fixed}
              </span>{" "}
              fixed
            </span>
            <span className={responsiveStyles.clientStatsStripDot} aria-hidden="true" />
            <span>
              <span className={responsiveStyles.clientStatsStripValueFlexible}>
                {clientStats.flexible}
              </span>{" "}
              flexible
            </span>
            <span className={responsiveStyles.clientStatsStripDot} aria-hidden="true" />
            <span>
              <span className={responsiveStyles.clientStatsStripValue}>
                {clientStats.avgDuration} min
              </span>{" "}
              avg visit
            </span>
          </div>
        )}

        <div>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="patient-search" className="sr-only">
              Search clients
            </label>

            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="relative min-w-0 flex-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  id="patient-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search clients by name or address"
                  className={`${responsiveStyles.searchInput} pl-9 sm:pl-10 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${searchQuery ? "pr-8" : ""}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    >
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
              <button
                type="button"
                onClick={openCreateModal}
                aria-label="Add client"
                className={`${responsiveStyles.addClientMobileButton} sm:hidden`}
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </button>
            </div>

            {lifecycleState !== "archived" && (
              <div
                className={responsiveStyles.clientFilterToggle}
                role="group"
                aria-label="Filter clients by window type"
              >
                {(["all", "fixed", "flexible"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setWindowFilter(filter)}
                    aria-pressed={windowFilter === filter}
                    className={`${responsiveStyles.clientFilterOption} ${
                      windowFilter === filter
                        ? responsiveStyles.clientFilterOptionActive
                        : responsiveStyles.clientFilterOptionInactive
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "fixed" ? "Fixed" : "Flexible"}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={openCreateModal}
              className={`hidden shrink-0 items-center justify-center gap-2 sm:inline-flex ${responsiveStyles.primaryButton}`}
            >
              <PlusIcon className="h-4 w-4" />
              Add Client
            </button>
          </div>

          {lifecycleState !== "archived" && (
            <div
              className={responsiveStyles.clientFilterPills}
              role="group"
              aria-label="Filter clients by window type"
            >
              {(["all", "fixed", "flexible"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setWindowFilter(filter)}
                  aria-pressed={windowFilter === filter}
                  className={`${responsiveStyles.clientFilterPill} ${
                    windowFilter === filter
                      ? responsiveStyles.clientFilterPillActive
                      : responsiveStyles.clientFilterPillInactive
                  }`}
                >
                  {filter === "all" ? "All" : filter === "fixed" ? "Fixed" : "Flexible"}
                </button>
              ))}
            </div>
          )}

          <PatientsTable
            isLoading={isLoadingPatients}
            isSubmitting={isSubmitting}
            patients={patients}
            lifecycleState={lifecycleState}
            searchQuery={searchQuery}
            windowFilter={windowFilter}
            onWindowFilterChange={setWindowFilter}
            onDelete={handleDelete}
            onEdit={openEditModal}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onArchiveSelected={() => void handleArchiveSelected()}
            isBulkArchiving={isBulkArchiving}
            onRestore={(patient) => void handleRestore(patient)}
            restoringId={restoringId}
            recurringTemplatesByPatientId={recurringTemplatesByPatientId}
          />

          <div className={responsiveStyles.clientPrivacyCard}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-400 dark:text-blue-500"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <div>
              <p className={responsiveStyles.clientPrivacyTitle}>Privacy Reminder</p>
              <p className={responsiveStyles.clientPrivacyText}>
                Client information entered here should be limited to what is necessary for
                scheduling and care delivery. Ensure you have appropriate authority to manage this
                data.
              </p>
            </div>
          </div>
        </div>

        {lifecycleState === "idle" && selectedIds.size > 0 && (
          <div className={responsiveStyles.mobileBulkBar}>
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className={responsiveStyles.mobileBulkClearButton}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className={responsiveStyles.tableBulkLabel}>{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => void handleArchiveSelected()}
              disabled={isBulkArchiving}
              className={responsiveStyles.tableBulkArchiveButton}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M21 8v13H3V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12h4" />
              </svg>
              {isBulkArchiving ? "Archiving…" : `Archive ${selectedIds.size}`}
            </button>
          </div>
        )}

        {pendingDeleteId && (
          <ConfirmDialog
            title="Archive client"
            message="They’ll move to the Archived tab. You can restore them there for 7 days."
            confirmLabel="Archive"
            confirmLoadingLabel="Archiving..."
            onConfirm={confirmDelete}
            onCancel={() => setPendingDeleteId(null)}
            isLoading={isDeletingPatient}
          />
        )}

        <PatientFormModal
          formMode={formMode}
          formValues={formValues}
          formErrors={formErrors}
          isOpen={isModalOpen}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          selectedPatient={selectedPatient}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onFieldChange={handleFieldChange}
          onVisitWindowChange={handleVisitWindowChange}
          onAddVisitWindow={handleAddVisitWindow}
          onRemoveVisitWindow={handleRemoveVisitWindow}
          onRecurringTemplateChange={handleRecurringTemplateChange}
          onAddRecurringTemplate={handleAddRecurringTemplate}
          onRemoveRecurringTemplate={handleRemoveRecurringTemplate}
          selectedVisitType={selectedVisitType}
          onVisitTypeChange={handleVisitTypeChange}
          onAddressChange={handleAddressChange}
          onAddressPick={handleAddressPick}
        />
      </section>
    </main>
  );
};

export default PatientsPage;
