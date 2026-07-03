import { useState } from "react";
import type { FormEvent } from "react";
import type { AddressSuggestion } from "../types";
import AddressAutocompleteInput from "../../../components/shared/AddressAutocompleteInput";
import { InfoDialog } from "../../../components/shared/InfoDialog";
import { responsiveStyles } from "../../../components/responsiveStyles";
import type { Patient, VisitTimeType } from "../../../../../shared/contracts";
import type {
  FormFieldErrors,
  FormMode,
  PatientFormRecurringTemplate,
  PatientFormValues,
  PatientFormVisitWindow,
} from "../domain/patientForm";
import {
  MAX_VISIT_DURATION_MINUTES,
  MIN_VISIT_DURATION_MINUTES,
  WEEKDAY_LABELS,
  getPatientDisplayName,
} from "../domain/patientForm";

type PatientFormModalProps = {
  formMode: FormMode;
  formValues: PatientFormValues;
  formErrors: FormFieldErrors;
  isOpen: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
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
  onRecurringTemplateChange: <K extends keyof PatientFormRecurringTemplate>(
    templateId: string,
    field: K,
    value: PatientFormRecurringTemplate[K],
  ) => void;
  onAddRecurringTemplate: () => void;
  onRemoveRecurringTemplate: (templateId: string) => void;
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
  isDirty,
  selectedPatient,
  onClose,
  onSubmit,
  onFieldChange,
  onVisitWindowChange,
  onAddVisitWindow,
  onRemoveVisitWindow,
  onRecurringTemplateChange,
  onAddRecurringTemplate,
  onRemoveRecurringTemplate,
  selectedVisitType,
  onVisitTypeChange,
  onAddressChange,
  onAddressPick,
}: PatientFormModalProps) => {
  const [isRecurringInfoOpen, setIsRecurringInfoOpen] = useState(false);

  if (!isOpen) {
    return null;
  }

  const isFixedWindowError = (message?: string | null): boolean =>
    typeof message === "string" && message.indexOf("fixed window must be at least") !== -1;

  const fixedWindowDurationError =
    formErrors.visitWindowRows?.map((row) => row.endTime).find(isFixedWindowError) ?? null;

  // The fixed-window error is cross-field, so flag every input it implicates: the
  // visit duration plus the too-short window's start and end times.
  const rowHasFixedWindowError = (index: number): boolean =>
    isFixedWindowError(formErrors.visitWindowRows?.[index]?.endTime);

  const isFormValid =
    formValues.firstName.trim().length > 0 &&
    formValues.lastName.trim().length > 0 &&
    formValues.address.trim().length > 0;

  return (
    <div className={responsiveStyles.modalBackdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
        className={responsiveStyles.modalSurfaceLarge}
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
              {formMode === "create" ? "Add Client" : "Edit Client"}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {formMode === "create"
                ? "Capture client details and preferred visit timing."
                : selectedPatient
                  ? `Update ${getPatientDisplayName(selectedPatient)}.`
                  : "Update client details."}
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

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <label htmlFor="patient-first-name" className={responsiveStyles.formLabel}>
                  First name
                </label>
                <span className={responsiveStyles.requiredAsterisk} aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="patient-first-name"
                value={formValues.firstName}
                onChange={(event) => onFieldChange("firstName", event.target.value)}
                className={responsiveStyles.formInput}
              />
              {formErrors.firstName && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">{formErrors.firstName}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <label htmlFor="patient-last-name" className={responsiveStyles.formLabel}>
                  Last name
                </label>
                <span className={responsiveStyles.requiredAsterisk} aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="patient-last-name"
                value={formValues.lastName}
                onChange={(event) => onFieldChange("lastName", event.target.value)}
                className={responsiveStyles.formInput}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className={responsiveStyles.formLabel}>Visit type</span>
              <div
                className={responsiveStyles.authSegmentedControl}
                role="group"
                aria-label="Visit type"
              >
                {(["flexible", "fixed"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onVisitTypeChange(type)}
                    aria-pressed={selectedVisitType === type}
                    className={`${responsiveStyles.authSegmentedButton} ${
                      selectedVisitType === type
                        ? responsiveStyles.authSegmentedButtonActive
                        : responsiveStyles.authSegmentedButtonInactive
                    }`}
                  >
                    {type === "flexible" ? "Flexible" : "Fixed"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="patient-visit-duration" className={responsiveStyles.formLabel}>
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
                className={
                  formErrors.visitDurationMinutes || fixedWindowDurationError
                    ? responsiveStyles.formInputError
                    : responsiveStyles.formInput
                }
              />
              {formErrors.visitDurationMinutes && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">
                  {formErrors.visitDurationMinutes}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={`sm:col-span-2 ${responsiveStyles.formGroupSection}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={responsiveStyles.formGroupEyebrow}>Visit windows</p>
                <button
                  type="button"
                  onClick={onAddVisitWindow}
                  className="rounded-xl border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                >
                  Add window
                </button>
              </div>

              {formValues.visitWindows.map((window, index) => (
                <div
                  key={window.id}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  {index > 0 && (
                    <p className="col-span-3 m-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Window {index + 1}
                    </p>
                  )}

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`patient-visit-start-${window.id}`}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {index === 0 ? "Preferred visit start" : "Start"}
                    </label>
                    <input
                      id={`patient-visit-start-${window.id}`}
                      type="time"
                      value={window.startTime}
                      onChange={(event) =>
                        onVisitWindowChange(window.id, "startTime", event.target.value)
                      }
                      className={`appearance-none ${
                        formErrors.visitWindowRows?.[index]?.startTime ||
                        rowHasFixedWindowError(index)
                          ? responsiveStyles.formInputError
                          : responsiveStyles.formInput
                      }`}
                    />
                    {formErrors.visitWindowRows?.[index]?.startTime && (
                      <p className="m-0 text-xs text-red-600 dark:text-red-400">
                        {formErrors.visitWindowRows[index].startTime}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`patient-visit-end-${window.id}`}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {index === 0 ? "Preferred visit end" : "End"}
                    </label>
                    <input
                      id={`patient-visit-end-${window.id}`}
                      type="time"
                      value={window.endTime}
                      onChange={(event) =>
                        onVisitWindowChange(window.id, "endTime", event.target.value)
                      }
                      className={`appearance-none ${
                        formErrors.visitWindowRows?.[index]?.endTime ||
                        rowHasFixedWindowError(index)
                          ? responsiveStyles.formInputError
                          : responsiveStyles.formInput
                      }`}
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
                  No preferred window set. This client will be treated as flexible, and timing can
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={`sm:col-span-2 ${responsiveStyles.formGroupSection}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className={responsiveStyles.formGroupEyebrow}>Recurring templates</p>
                  <button
                    type="button"
                    aria-label="What are recurring templates?"
                    onClick={() => setIsRecurringInfoOpen(true)}
                    className={responsiveStyles.infoIconButton}
                  >
                    i
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onAddRecurringTemplate}
                  className="rounded-xl border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                >
                  Add recurring template
                </button>
              </div>

              {formValues.recurringTemplates.length === 0 && (
                <p className={responsiveStyles.recurrenceValue}>
                  Automatically schedule this client on repeating days each week. Add a template to
                  get started.
                </p>
              )}

              {formValues.recurringTemplates.map((template, templateIndex) => {
                const templateKey = template.id;
                const templateErrors = formErrors.recurringTemplateRows?.[templateIndex];

                const selectedDayNames = template.daysOfWeek
                  .map((d) => WEEKDAY_LABELS[d])
                  .filter(Boolean);
                const repeatSummary =
                  selectedDayNames.length > 0
                    ? `Repeats every ${selectedDayNames.join(", ")}`
                    : null;

                return (
                  <div
                    key={templateKey}
                    className="flex flex-col gap-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    {/* Template name */}
                    <div className="flex flex-col gap-1 p-3">
                      <label
                        htmlFor={`recurring-template-name-${templateKey}`}
                        className={responsiveStyles.recurrenceLabel}
                      >
                        Template name{" "}
                        <span className="font-normal text-slate-400 dark:text-slate-500">
                          (optional)
                        </span>
                      </label>
                      <input
                        id={`recurring-template-name-${templateKey}`}
                        value={template.name}
                        placeholder="e.g. Weekly check-in"
                        onChange={(event) =>
                          onRecurringTemplateChange(templateKey, "name", event.target.value)
                        }
                        className={responsiveStyles.recurrenceInput}
                      />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800" />

                    {/* Schedule section */}
                    <div className="flex flex-col gap-3 p-3">
                      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Schedule
                      </p>
                      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`recurring-template-start-date-${templateKey}`}
                            className={responsiveStyles.recurrenceLabel}
                          >
                            Start date
                          </label>
                          <input
                            id={`recurring-template-start-date-${templateKey}`}
                            type="date"
                            value={template.startDate}
                            onChange={(event) =>
                              onRecurringTemplateChange(
                                templateKey,
                                "startDate",
                                event.target.value,
                              )
                            }
                            className={responsiveStyles.recurrenceInput}
                          />
                          {templateErrors?.startDate && (
                            <p className="m-0 text-xs text-red-600 dark:text-red-400">
                              {templateErrors.startDate}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`recurring-template-end-date-${templateKey}`}
                            className={responsiveStyles.recurrenceLabel}
                          >
                            End date
                          </label>
                          <input
                            id={`recurring-template-end-date-${templateKey}`}
                            type="date"
                            value={template.endDate}
                            onChange={(event) =>
                              onRecurringTemplateChange(templateKey, "endDate", event.target.value)
                            }
                            className={responsiveStyles.recurrenceInput}
                          />
                          {templateErrors?.endDate ? (
                            <p className="m-0 text-xs text-red-600 dark:text-red-400">
                              {templateErrors.endDate}
                            </p>
                          ) : (
                            <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                              Leave blank to repeat indefinitely
                            </p>
                          )}
                        </div>
                      </div>

                      {template.templateId && (
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`recurring-template-end-from-date-${templateKey}`}
                            className={responsiveStyles.recurrenceLabel}
                          >
                            End from date forward
                          </label>
                          <input
                            id={`recurring-template-end-from-date-${templateKey}`}
                            type="date"
                            value={template.endFromDate}
                            onChange={(event) =>
                              onRecurringTemplateChange(
                                templateKey,
                                "endFromDate",
                                event.target.value,
                              )
                            }
                            className={responsiveStyles.recurrenceInput}
                          />
                          <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                            Sets template end date to the day before this date.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800" />

                    {/* Repeat on section */}
                    <div className="flex flex-col gap-3 p-3">
                      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Repeat on
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_LABELS.map((label, dayIndex) => {
                          const isSelected = template.daysOfWeek.indexOf(dayIndex) !== -1;
                          return (
                            <button
                              key={dayIndex}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                const next = isSelected
                                  ? template.daysOfWeek.filter((d) => d !== dayIndex)
                                  : [...template.daysOfWeek, dayIndex].sort((a, b) => a - b);
                                onRecurringTemplateChange(templateKey, "daysOfWeek", next);
                              }}
                              className={`min-w-[44px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                isSelected
                                  ? "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {repeatSummary && (
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <p className="m-0 text-xs text-blue-700 dark:text-blue-300">
                            {repeatSummary}
                          </p>
                        </div>
                      )}
                      {templateErrors?.daysOfWeek && (
                        <p className="m-0 text-xs text-red-600 dark:text-red-400">
                          {templateErrors.daysOfWeek}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800" />

                    {/* Active toggle */}
                    <div className="flex flex-col gap-1 p-3">
                      <label className="flex cursor-pointer items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Template is active
                        </span>
                        <span
                          role="switch"
                          aria-checked={template.isActive}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            template.isActive ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={template.isActive}
                            onChange={(event) =>
                              onRecurringTemplateChange(
                                templateKey,
                                "isActive",
                                event.target.checked,
                              )
                            }
                          />
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              template.isActive ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </span>
                      </label>
                      <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                        {template.isActive
                          ? "Active — new visits will be generated from this template."
                          : "Inactive — no new visits will be generated."}
                      </p>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800" />

                    {/* Remove */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <p className="m-0 text-xs text-slate-400 dark:text-slate-500">
                        Visits use this client&apos;s saved windows and duration.
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemoveRecurringTemplate(templateKey)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={responsiveStyles.modalStickyFooter}>
            {fixedWindowDurationError && (
              <p className={responsiveStyles.modalStickyFooterError} role="alert">
                {fixedWindowDurationError}
              </p>
            )}
            <div className={responsiveStyles.modalStickyFooterButtons}>
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
                disabled={isSubmitting || !isFormValid || (formMode === "edit" && !isDirty)}
                className={responsiveStyles.primaryButton}
              >
                {isSubmitting
                  ? "Saving..."
                  : formMode === "create"
                    ? "Save new client"
                    : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <InfoDialog
        open={isRecurringInfoOpen}
        title="Recurring templates"
        onClose={() => setIsRecurringInfoOpen(false)}
      >
        <p className={responsiveStyles.confirmDialogMessage}>
          Automatically schedule this client&apos;s visits on repeating days each week — so you
          don&apos;t have to add them to every route by hand.
        </p>
        <p className="m-0 mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          How it works
        </p>
        <ul className="m-0 mb-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Pick the weekdays to repeat — e.g. Mon, Wed, Fri.</li>
          <li>Set a start date; leave the end date blank to repeat indefinitely.</li>
          <li>On matching days this client is auto-added to your Route Planner.</li>
          <li>Visits reuse this client&apos;s saved visit window and duration above.</li>
        </ul>
        <p className="m-0 mb-5 text-sm text-slate-500 dark:text-slate-400">
          Set it once and your regular clients stay on the schedule automatically — no manual
          re-entry each week.
        </p>
      </InfoDialog>
    </div>
  );
};
