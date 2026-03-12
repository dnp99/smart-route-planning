import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import AddressAutocompleteInput from "../AddressAutocompleteInput";
import { responsiveStyles } from "../responsiveStyles";
import type { Patient } from "../../../../shared/contracts";
import type { FormFieldErrors, FormMode, PatientFormValues } from "./patientForm";
import { getPatientDisplayName } from "./patientForm";

type PatientFormModalProps = {
  formMode: FormMode;
  formValues: PatientFormValues;
  formErrors: FormFieldErrors;
  isOpen: boolean;
  isSubmitting: boolean;
  selectedPatient: Patient | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onFieldChange: <K extends keyof PatientFormValues>(field: K, value: PatientFormValues[K]) => void;
  onAddressChange: (value: string) => void;
  onAddressPick: (suggestion: AddressSuggestion) => void;
};

export const PatientFormModal = ({
  formMode,
  formValues,
  formErrors,
  isOpen,
  isSubmitting,
  selectedPatient,
  onClose,
  onSubmit,
  onFieldChange,
  onAddressChange,
  onAddressPick,
}: PatientFormModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-w-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="patient-modal-title"
              className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100"
            >
              {formMode === "create" ? "Add New Patient" : "Edit Patient"}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {formMode === "create"
                ? "Capture patient details and preferred visit timing."
                : selectedPatient
                  ? `Update ${getPatientDisplayName(selectedPatient)}.`
                  : "Update patient details."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
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
                onChange={(event) => onFieldChange("firstName", event.target.value)}
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
                onChange={(event) => onFieldChange("lastName", event.target.value)}
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
            onChange={onAddressChange}
            onSuggestionSelect={onAddressChange}
            onSuggestionPick={onAddressPick}
            errorText={formErrors.address}
            helperText="Type at least 3 characters to load address suggestions."
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
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
                onChange={(event) => onFieldChange("preferredVisitStartTime", event.target.value)}
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
                onChange={(event) => onFieldChange("preferredVisitEndTime", event.target.value)}
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
              onChange={(event) => onFieldChange("visitTimeType", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="fixed">Fixed</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={responsiveStyles.secondaryButton}
            >
              Cancel
            </button>
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
      </div>
    </div>
  );
};
