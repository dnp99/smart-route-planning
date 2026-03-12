import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import { responsiveStyles } from "../responsiveStyles";
import type { Patient } from "../../../../shared/contracts";
import { PatientFormModal } from "./PatientFormModal";
import { PatientsTable } from "./PatientsTable";
import {
  EMPTY_FORM,
  type FormFieldErrors,
  type FormMode,
  type PatientFormValues,
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

const PatientsPage = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
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

  const fetchPatients = async (query: string) => {
    setIsLoadingPatients(true);
    setPageError("");

    try {
      const nextPatients = await listPatients(query);
      setPatients(nextPatients);

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
          <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Patients
          </h1>
          <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
            Search, create, update, and delete patients for route-planning workflows.
          </p>
        </div>

        {pageError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {pageError}
          </p>
        )}

        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="patient-search" className="sr-only">
              Search patients
            </label>

            <div className="min-w-0 flex-1">
              <input
                id="patient-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by first or last name"
                className={responsiveStyles.searchInput}
              />
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 sm:w-auto sm:shrink-0"
            >
              Add New Patient
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
          onAddressChange={handleAddressChange}
          onAddressPick={handleAddressPick}
        />
      </section>
    </main>
  );
};

export default PatientsPage;
