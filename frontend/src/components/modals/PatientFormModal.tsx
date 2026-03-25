import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import AddressAutocompleteInput from "../AddressAutocompleteInput";
import { responsiveStyles } from "../responsiveStyles";
import type { Patient, VisitTimeType } from "../../../../shared/contracts";
import type {
  FormFieldErrors,
  FormMode,
  PatientFormValues,
  PatientFormVisitWindow,
} from "../patients/patientForm";
import {
  MAX_VISIT_DURATION_MINUTES,
  MIN_VISIT_DURATION_MINUTES,
  getPatientDisplayName,
} from "../patients/patientForm";

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
  onVisitWindowChange: <K extends keyof PatientFormVisitWindow>(
    windowId: string,
    field: K,
    value: PatientFormVisitWindow[K],
  ) => void;
  onAddVisitWindow: () => void;
  onRemoveVisitWindow: (windowId: string) => void;
  selectedVisitType: VisitTimeType;
  onVisitTypeChange: (visitTimeType: VisitTimeType) => void;
  onAddressChange: (value: string) => void;
  onAddressPick: (suggestion: AddressSuggestion) => void;
};

const CloseIcon = ({ className }: { className?: string }) => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

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
  onVisitWindowChange,
  onAddVisitWindow,
  onRemoveVisitWindow,
  selectedVisitType,
  onVisitTypeChange,
  onAddressChange,
  onAddressPick,
}: PatientFormModalProps) => {
  if (!isOpen) {
    return null;
  }

  const fixedWindowDurationError =
    formErrors.visitWindowRows
      ?.map((row) => row.endTime)
      .find(
        (message): message is string =>
          typeof message === "string" && message.indexOf("fixed window must be at least") !== -1,
      ) ?? null;

  const isFormValid =
    formValues.firstName.trim().length > 0 &&
    formValues.lastName.trim().length > 0 &&
    formValues.address.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
        className="animate-slide-up motion-reduce:animate-none sm:animate-none max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="sm:hidden -mx-5 -mt-5 mb-2 flex justify-center pb-1 pt-2.5">
          <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="-mx-5 -mt-2 mb-4 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 pb-3 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:mb-5 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-0 sm:backdrop-blur-0">
          <div>
            <h2
              id="patient-modal-title"
              className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100"
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
            aria-label="Close modal"
            title="Close modal"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="patient-first-name"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  First name
                </label>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  Required
                </span>
              </div>
              <input
                id="patient-first-name"
                value={formValues.firstName}
                onChange={(event) => onFieldChange("firstName", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {formErrors.firstName && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">{formErrors.firstName}</p>
              )}
            </div>

            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="patient-last-name"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Last name
                </label>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  Required
                </span>
              </div>
              <input
                id="patient-last-name"
                value={formValues.lastName}
                onChange={(event) => onFieldChange("lastName", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {formErrors.lastName && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">{formErrors.lastName}</p>
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
                htmlFor="patient-visit-type"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Visit type
              </label>
              <select
                id="patient-visit-type"
                value={selectedVisitType}
                onChange={(event) => onVisitTypeChange(event.target.value as VisitTimeType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="fixed">Fixed</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label
                htmlFor="patient-visit-duration"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Visit duration (minutes)
              </label>
              <input
                id="patient-visit-duration"
                type="number"
                min={MIN_VISIT_DURATION_MINUTES}
                max={MAX_VISIT_DURATION_MINUTES}
                step={1}
                value={formValues.visitDurationMinutes}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  const safeValue = parsed !== parsed ? 0 : parsed;
                  onFieldChange("visitDurationMinutes", safeValue);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {formErrors.visitDurationMinutes && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">
                  {formErrors.visitDurationMinutes}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Visit windows
                </p>
                <button
                  type="button"
                  onClick={onAddVisitWindow}
                  className="rounded-xl px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add window
                </button>
              </div>

              {formValues.visitWindows.map((window, index) => (
                <div
                  key={window.id}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="grid gap-1">
                    <label
                      htmlFor={`patient-visit-start-${window.id}`}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {index === 0 ? "Preferred visit start" : `Start ${index + 1}`}
                    </label>
                    <input
                      id={`patient-visit-start-${window.id}`}
                      type="time"
                      value={window.startTime}
                      onChange={(event) =>
                        onVisitWindowChange(window.id, "startTime", event.target.value)
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    {formErrors.visitWindowRows?.[index]?.startTime && (
                      <p className="m-0 text-xs text-red-600 dark:text-red-400">
                        {formErrors.visitWindowRows[index].startTime}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-1">
                    <label
                      htmlFor={`patient-visit-end-${window.id}`}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {index === 0 ? "Preferred visit end" : `End ${index + 1}`}
                    </label>
                    <input
                      id={`patient-visit-end-${window.id}`}
                      type="time"
                      value={window.endTime}
                      onChange={(event) =>
                        onVisitWindowChange(window.id, "endTime", event.target.value)
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    {formErrors.visitWindowRows?.[index]?.endTime &&
                      formErrors.visitWindowRows[index].endTime !== fixedWindowDurationError && (
                        <p className="m-0 text-xs text-red-600 dark:text-red-400">
                          {formErrors.visitWindowRows[index].endTime}
                        </p>
                      )}
                  </div>

                  <div className="flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() => onRemoveVisitWindow(window.id)}
                      aria-label="Remove window"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-4 w-4"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {formValues.visitWindows.length === 0 && (
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                  No preferred window set. This patient will be treated as flexible, and timing can
                  be picked during route planning.
                </p>
              )}

              {formErrors.visitWindows && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">
                  {formErrors.visitWindows}
                </p>
              )}
            </div>
          </div>

          {fixedWindowDurationError && (
            <p className="m-0 text-xs text-red-600 dark:text-red-400">{fixedWindowDurationError}</p>
          )}

          <div className="sticky bottom-0 z-10 -mx-5 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0 sm:flex-row sm:justify-end">
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
              disabled={isSubmitting || !isFormValid}
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
