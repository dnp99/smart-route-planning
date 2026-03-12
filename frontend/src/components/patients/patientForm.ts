import type { CreatePatientRequest, Patient, VisitTimeType } from "../../../../shared/contracts";

export type PatientFormValues = {
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId: string | null;
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  visitTimeType: VisitTimeType;
};

export type FormMode = "create" | "edit";
export type FormFieldErrors = Partial<Record<keyof PatientFormValues, string>>;

export const EMPTY_FORM: PatientFormValues = {
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

export const toTimeInput = (value: string) => value.slice(0, 5);

export const toFormValues = (patient: Patient): PatientFormValues => ({
  firstName: patient.firstName,
  lastName: patient.lastName,
  address: patient.address,
  googlePlaceId: patient.googlePlaceId,
  preferredVisitStartTime: toTimeInput(patient.preferredVisitStartTime),
  preferredVisitEndTime: toTimeInput(patient.preferredVisitEndTime),
  visitTimeType: patient.visitTimeType,
});

export const formatTimeWindow = (patient: Patient) =>
  `${toTimeInput(patient.preferredVisitStartTime)} - ${toTimeInput(patient.preferredVisitEndTime)}`;

export const getPatientDisplayName = (patient: Patient) =>
  `${patient.firstName} ${patient.lastName}`.trim();

export const toCreateRequest = (values: PatientFormValues): CreatePatientRequest => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  address: values.address.trim(),
  googlePlaceId: values.googlePlaceId,
  preferredVisitStartTime: values.preferredVisitStartTime,
  preferredVisitEndTime: values.preferredVisitEndTime,
  visitTimeType: values.visitTimeType,
});

export const validateForm = (values: PatientFormValues): FormFieldErrors => {
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
