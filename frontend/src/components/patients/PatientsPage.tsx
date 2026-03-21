import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import { responsiveStyles } from "../responsiveStyles";
import type { Patient, VisitTimeType } from "../../../../shared/contracts";
import { PatientFormModal } from "./PatientFormModal";
import { PatientsTable } from "./PatientsTable";
import {
  EMPTY_FORM,
  createEmptyVisitWindow,
  type FormFieldErrors,
  type FormMode,
  type PatientFormValues,
  type PatientFormVisitWindow,
  toCreateRequest,
  toFormValues,
  validateForm,
} from "./patientForm";
import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "./patientService";

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
  const [totalPatientCount, setTotalPatientCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<PatientFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );
  const selectedVisitType: VisitTimeType =
    formValues.visitWindows[0]?.visitTimeType ?? "flexible";

  const fetchPatients = async (query: string) => {
    setIsLoadingPatients(true);
    setPageError("");

    try {
      const nextPatients = await listPatients(query);
      setPatients(nextPatients);
      if (!query) setTotalPatientCount(nextPatients.length);

      if (selectedPatientId && !nextPatients.some((patient) => patient.id === selectedPatientId)) {
        setSelectedPatientId(null);
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load patients.");
    } finally {
      setIsLoadingPatients(false);
    }
  };

  useEffect(() => {
    void fetchPatients(searchQuery);
  }, [searchQuery]);

  const resetFormState = () => {
    setSelectedPatientId(null);
    setFormMode("create");
    setFormValues(EMPTY_FORM);
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
    setFormValues(toFormValues(patient));
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
        await createPatient(toCreateRequest(formValues));
        closeModal();
        setSearchQuery("");
        await fetchPatients("");
        return;
      }

      if (!selectedPatientId) {
        setPageError("Please select a patient to edit.");
        return;
      }

      const updated = await updatePatient(selectedPatientId, toCreateRequest(formValues));
      setSelectedPatientId(updated.id);
      setFormMode("edit");
      setFormValues(toFormValues(updated));
      await fetchPatients(searchQuery);
      setIsModalOpen(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (patientId: string) => {
    if (!window.confirm("Delete this patient? This action cannot be undone.")) {
      return;
    }

    setIsSubmitting(true);
    setPageError("");

    try {
      await deletePatient(patientId);
      if (selectedPatientId === patientId) {
        closeModal();
      }
      await fetchPatients(searchQuery);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to delete patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        <div className={responsiveStyles.sectionHeader}>
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {searchQuery.trim()
                ? `Patients (${patients.length} of ${totalPatientCount})`
                : `Patients (${patients.length})`}
            </h1>
            <button
              type="button"
              onClick={openCreateModal}
              aria-label="Add patient"
              title="Add patient"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:hidden"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
            Manage patients for route planning.
          </p>
        </div>

        {pageError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {pageError}
          </p>
        )}

        <div>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="patient-search" className="sr-only">
              Search patients
            </label>

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
                placeholder="Search patients by name or address"
                className={`${responsiveStyles.searchInput} pl-9 sm:pl-10 ${searchQuery ? "pr-8" : ""}`}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="hidden w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 sm:inline-flex sm:w-auto sm:shrink-0"
            >
              <PlusIcon className="h-4 w-4" />
              Add Patient
            </button>
          </div>

          <PatientsTable
            isLoading={isLoadingPatients}
            isSubmitting={isSubmitting}
            patients={patients}
            searchQuery={searchQuery}
            onDelete={handleDelete}
            onEdit={openEditModal}
          />
        </div>

        <PatientFormModal
          formMode={formMode}
          formValues={formValues}
          formErrors={formErrors}
          isOpen={isModalOpen}
          isSubmitting={isSubmitting}
          selectedPatient={selectedPatient}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onFieldChange={handleFieldChange}
          onVisitWindowChange={handleVisitWindowChange}
          onAddVisitWindow={handleAddVisitWindow}
          onRemoveVisitWindow={handleRemoveVisitWindow}
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
