import { useState } from "react";
import type { FormEvent } from "react";
import type { Patient, VisitTimeType } from "../../../../../shared/contracts";
import type { AddressSuggestion } from "../types";
import {
  EMPTY_FORM,
  buildRecurringTemplateMutationPlan,
  createEmptyRecurringTemplate,
  createEmptyRecurringTemplateWindow,
  createEmptyVisitWindow,
  type FormFieldErrors,
  type PatientFormRecurringTemplate,
  type PatientFormRecurringTemplateWindow,
  type PatientFormValues,
  type PatientFormVisitWindow,
  toCreateRequest,
  validateForm,
} from "../patients/patientForm";
import { createPatient } from "../patients/patientService";
import {
  createRecurringVisitTemplate,
  deleteRecurringVisitTemplate,
  updateRecurringVisitTemplate,
} from "../patients/recurringVisitTemplateService";

type UseCreatePatientFormOptions = {
  onPatientCreated: (patient: Patient) => void;
};

export const useCreatePatientForm = ({ onPatientCreated }: UseCreatePatientFormOptions) => {
  const [locallyCreatedPatients, setLocallyCreatedPatients] = useState<Patient[]>([]);
  const [isCreatePatientModalOpen, setIsCreatePatientModalOpen] = useState(false);
  const [createPatientFormValues, setCreatePatientFormValues] =
    useState<PatientFormValues>(EMPTY_FORM);
  const [createPatientFormErrors, setCreatePatientFormErrors] = useState<FormFieldErrors>({});
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [createPatientError, setCreatePatientError] = useState("");

  const selectedCreateVisitType =
    createPatientFormValues.visitWindows[0]?.visitTimeType ?? "flexible";

  const resetCreatePatientFormState = () => {
    setCreatePatientFormValues(EMPTY_FORM);
    setCreatePatientFormErrors({});
    setCreatePatientError("");
  };

  const openCreatePatientModal = () => {
    resetCreatePatientFormState();
    setIsCreatePatientModalOpen(true);
  };

  const closeCreatePatientModal = () => {
    if (isCreatingPatient) {
      return;
    }

    setIsCreatePatientModalOpen(false);
    resetCreatePatientFormState();
  };

  const handleCreatePatientFieldChange = <K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K],
  ) => {
    setCreatePatientFormValues((current) => ({ ...current, [field]: value }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleCreatePatientVisitWindowChange = <K extends keyof PatientFormVisitWindow>(
    windowId: string,
    field: K,
    value: PatientFormVisitWindow[K],
  ) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      visitWindows: current.visitWindows.map((window) =>
        window.id === windowId ? { ...window, [field]: value } : window,
      ),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleAddCreatePatientVisitWindow = () => {
    setCreatePatientFormValues((current) => ({
      ...current,
      visitWindows: [
        ...current.visitWindows,
        createEmptyVisitWindow(
          current.visitWindows[0]?.visitTimeType ?? "flexible",
          current.visitWindows.length,
        ),
      ],
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleRemoveCreatePatientVisitWindow = (windowId: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      visitWindows: current.visitWindows.filter((window) => window.id !== windowId),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleCreatePatientVisitTypeChange = (visitTimeType: VisitTimeType) => {
    setCreatePatientFormValues((current) => {
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
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleCreateRecurringTemplateChange = <K extends keyof PatientFormRecurringTemplate>(
    templateId: string,
    field: K,
    value: PatientFormRecurringTemplate[K],
  ) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.map((template) =>
        template.id === templateId ? { ...template, [field]: value } : template,
      ),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleAddCreateRecurringTemplate = () => {
    setCreatePatientFormValues((current) => ({
      ...current,
      recurringTemplates: [...current.recurringTemplates, createEmptyRecurringTemplate()],
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleRemoveCreateRecurringTemplate = (templateId: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.filter(
        (template) => template.id !== templateId,
      ),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleAddCreateRecurringTemplateWindow = (templateId: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          windows: [
            ...template.windows,
            createEmptyRecurringTemplateWindow(template.windows.length + 1),
          ],
        };
      }),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleRemoveCreateRecurringTemplateWindow = (templateId: string, windowId: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          windows: template.windows.filter((window) => window.id !== windowId),
        };
      }),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleCreateRecurringTemplateWindowChange = <
    K extends keyof PatientFormRecurringTemplateWindow,
  >(
    templateId: string,
    windowId: string,
    field: K,
    value: PatientFormRecurringTemplateWindow[K],
  ) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      recurringTemplates: current.recurringTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          windows: template.windows.map((window) =>
            window.id === windowId ? { ...window, [field]: value } : window,
          ),
        };
      }),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      recurringTemplates: undefined,
      recurringTemplateRows: undefined,
    }));
  };

  const handleCreatePatientAddressChange = (value: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      address: value,
      googlePlaceId: null,
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      address: undefined,
    }));
  };

  const handleCreatePatientAddressPick = (suggestion: AddressSuggestion) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      address: suggestion.displayName,
      googlePlaceId: suggestion.placeId,
    }));
  };

  const handleCreatePatientSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePatientError("");

    const nextErrors = validateForm(createPatientFormValues);
    setCreatePatientFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsCreatingPatient(true);
    try {
      const createdPatient = await createPatient(toCreateRequest(createPatientFormValues));
      const mutationPlan = buildRecurringTemplateMutationPlan(
        createdPatient.id,
        createPatientFormValues,
        [],
      );
      await Promise.all(
        mutationPlan.remove.map((templateId) => deleteRecurringVisitTemplate(templateId)),
      );
      await Promise.all(
        mutationPlan.create.map((request) => createRecurringVisitTemplate(request)),
      );
      await Promise.all(
        mutationPlan.update.map(({ templateId, request }) =>
          updateRecurringVisitTemplate(templateId, request),
        ),
      );

      setLocallyCreatedPatients((current) => {
        const next = current.filter((patient) => patient.id !== createdPatient.id);
        return [createdPatient, ...next];
      });
      onPatientCreated(createdPatient);
      setIsCreatePatientModalOpen(false);
      resetCreatePatientFormState();
    } catch (error) {
      setCreatePatientError(error instanceof Error ? error.message : "Unable to create client.");
    } finally {
      setIsCreatingPatient(false);
    }
  };

  return {
    locallyCreatedPatients,
    isCreatePatientModalOpen,
    createPatientFormValues,
    createPatientFormErrors,
    isCreatingPatient,
    createPatientError,
    selectedCreateVisitType,
    openCreatePatientModal,
    closeCreatePatientModal,
    handleCreatePatientFieldChange,
    handleCreatePatientVisitWindowChange,
    handleAddCreatePatientVisitWindow,
    handleRemoveCreatePatientVisitWindow,
    handleCreatePatientVisitTypeChange,
    handleCreateRecurringTemplateChange,
    handleAddCreateRecurringTemplate,
    handleRemoveCreateRecurringTemplate,
    handleAddCreateRecurringTemplateWindow,
    handleRemoveCreateRecurringTemplateWindow,
    handleCreateRecurringTemplateWindowChange,
    handleCreatePatientAddressChange,
    handleCreatePatientAddressPick,
    handleCreatePatientSubmit,
  };
};
