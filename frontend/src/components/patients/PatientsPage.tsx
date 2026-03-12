import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import type { CreatePatientRequest, Patient, VisitTimeType } from "../../../../shared/contracts";
import AddressAutocompleteInput from "../AddressAutocompleteInput";
import { responsiveStyles } from "../responsiveStyles";
import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "./patientService";

type PatientFormValues = {
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId: string | null;
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  visitTimeType: VisitTimeType;
};

type FormMode = "create" | "edit";

type FormFieldErrors = Partial<Record<keyof PatientFormValues, string>>;

const EMPTY_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  address: "",
  googlePlaceId: null,
  preferredVisitStartTime: "09:00",
  preferredVisitEndTime: "10:00",
  visitTimeType: "fixed",
};

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

const toTimeInput = (value: string) => value.slice(0, 5);

const toFormValues = (patient: Patient): PatientFormValues => ({
  firstName: patient.firstName,
  lastName: patient.lastName,
  address: patient.address,
  googlePlaceId: patient.googlePlaceId,
  preferredVisitStartTime: toTimeInput(patient.preferredVisitStartTime),
  preferredVisitEndTime: toTimeInput(patient.preferredVisitEndTime),
  visitTimeType: patient.visitTimeType,
});

const formatTimeWindow = (patient: Patient) =>
  `${toTimeInput(patient.preferredVisitStartTime)} - ${toTimeInput(patient.preferredVisitEndTime)}`;

const getPatientDisplayName = (patient: Patient) =>
  `${patient.firstName} ${patient.lastName}`.trim();

const toCreateRequest = (values: PatientFormValues): CreatePatientRequest => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  address: values.address.trim(),
  googlePlaceId: values.googlePlaceId,
  preferredVisitStartTime: values.preferredVisitStartTime,
  preferredVisitEndTime: values.preferredVisitEndTime,
  visitTimeType: values.visitTimeType,
});

const validateForm = (values: PatientFormValues): FormFieldErrors => {
  const errors: FormFieldErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (!values.address.trim()) {
    errors.address = "Address is required.";
  }

  if (!HH_MM_PATTERN.test(values.preferredVisitStartTime)) {
    errors.preferredVisitStartTime = "Start time must use HH:MM 24-hour format.";
  }

  if (!HH_MM_PATTERN.test(values.preferredVisitEndTime)) {
    errors.preferredVisitEndTime = "End time must use HH:MM 24-hour format.";
  }

  if (
    !errors.preferredVisitStartTime &&
    !errors.preferredVisitEndTime &&
    timeToMinutes(values.preferredVisitEndTime) <= timeToMinutes(values.preferredVisitStartTime)
  ) {
    errors.preferredVisitEndTime =
      "End time must be later than start time (cross-midnight windows are not supported).";
  }

  return errors;
};

function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [pageError, setPageError] = useState("");

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<PatientFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setFormMode("create");
        setFormValues(EMPTY_FORM);
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

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setFormMode("edit");
    setFormValues(toFormValues(patient));
    setFormErrors({});
    setPageError("");
  };

  const handleResetToCreate = () => {
    setSelectedPatientId(null);
    setFormMode("create");
    setFormValues(EMPTY_FORM);
    setFormErrors({});
    setPageError("");
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
        handleResetToCreate();
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
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPatientId || formMode !== "edit") {
      return;
    }

    const confirmDelete = window.confirm(
      "Delete this patient? This action cannot be undone.",
    );

    if (!confirmDelete) {
      return;
    }

    setIsSubmitting(true);
    setPageError("");

    try {
      await deletePatient(selectedPatientId);
      handleResetToCreate();
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="grid gap-1">
              <label
                htmlFor="patient-search"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Search patients
              </label>
              <input
                id="patient-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by first or last name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
              {isLoadingPatients ? (
                <p className="m-0 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                  Loading patients…
                </p>
              ) : patients.length === 0 ? (
                <p className="m-0 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery.trim()
                    ? "No patients match this search."
                    : "No patients added yet."}
                </p>
              ) : (
                <ul className="m-0 max-h-[30rem] list-none space-y-2 overflow-y-auto p-2">
                  {patients.map((patient) => {
                    const isSelected = selectedPatientId === patient.id;

                    return (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectPatient(patient)}
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-left transition",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                              : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {getPatientDisplayName(patient)}
                            </p>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                                patient.visitTimeType === "fixed"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
                                  : "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200",
                              ].join(" ")}
                            >
                              {patient.visitTimeType}
                            </span>
                          </div>
                          <p className="mb-0 mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {patient.address}
                          </p>
                          <p className="mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Preferred window: {formatTimeWindow(patient)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formMode === "create" ? "Create Patient" : "Edit Patient"}
              </h2>
              {formMode === "edit" && selectedPatient && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {getPatientDisplayName(selectedPatient)}
                </span>
              )}
            </div>

            <form className="grid gap-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label
                    htmlFor="patient-first-name"
                    className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    First name
                  </label>
                  <input
                    id="patient-first-name"
                    value={formValues.firstName}
                    onChange={(event) => handleFieldChange("firstName", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {formErrors.firstName && (
                    <p className="m-0 text-xs text-red-600 dark:text-red-400">
                      {formErrors.firstName}
                    </p>
                  )}
                </div>

                <div className="grid gap-1">
                  <label
                    htmlFor="patient-last-name"
                    className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Last name
                  </label>
                  <input
                    id="patient-last-name"
                    value={formValues.lastName}
                    onChange={(event) => handleFieldChange("lastName", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {formErrors.lastName && (
                    <p className="m-0 text-xs text-red-600 dark:text-red-400">
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <AddressAutocompleteInput
                id="patient-address"
                label="Address"
                placeholder="Search and select an address"
                value={formValues.address}
                onChange={handleAddressChange}
                onSuggestionSelect={handleAddressChange}
                onSuggestionPick={handleAddressPick}
                errorText={formErrors.address}
                helperText="Type at least 3 characters to load address suggestions."
                required
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label
                    htmlFor="patient-visit-start"
                    className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Preferred visit start
                  </label>
                  <input
                    id="patient-visit-start"
                    type="time"
                    value={formValues.preferredVisitStartTime}
                    onChange={(event) =>
                      handleFieldChange("preferredVisitStartTime", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {formErrors.preferredVisitStartTime && (
                    <p className="m-0 text-xs text-red-600 dark:text-red-400">
                      {formErrors.preferredVisitStartTime}
                    </p>
                  )}
                </div>

                <div className="grid gap-1">
                  <label
                    htmlFor="patient-visit-end"
                    className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Preferred visit end
                  </label>
                  <input
                    id="patient-visit-end"
                    type="time"
                    value={formValues.preferredVisitEndTime}
                    onChange={(event) =>
                      handleFieldChange("preferredVisitEndTime", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {formErrors.preferredVisitEndTime && (
                    <p className="m-0 text-xs text-red-600 dark:text-red-400">
                      {formErrors.preferredVisitEndTime}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-1">
                <label
                  htmlFor="patient-visit-time-type"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Visit time type
                </label>
                <select
                  id="patient-visit-time-type"
                  value={formValues.visitTimeType}
                  onChange={(event) =>
                    handleFieldChange("visitTimeType", event.target.value as VisitTimeType)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="fixed">Fixed</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>

              <div className={responsiveStyles.actionButtons}>
                <button
                  type="button"
                  onClick={handleResetToCreate}
                  disabled={isSubmitting}
                  className={responsiveStyles.secondaryButton}
                >
                  Reset
                </button>
                {formMode === "edit" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30 sm:w-auto sm:py-1.5"
                  >
                    Delete patient
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={responsiveStyles.optimizeButton}
                >
                  {isSubmitting
                    ? "Saving..."
                    : formMode === "create"
                      ? "Save new patient"
                      : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

export default PatientsPage;
