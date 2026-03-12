import { describe, expect, it } from "vitest";
import { HttpError } from "../http";
import {
  validateCreatePatientPayload,
  validateTimeWindow,
  validateUpdatePatientPayload,
} from "./patientValidation";

describe("patientValidation", () => {
  it("validates create payload and normalizes optional googlePlaceId", () => {
    const payload = validateCreatePatientPayload({
      firstName: " Jane ",
      lastName: " Doe ",
      address: " 123 Main St ",
      googlePlaceId: "   ",
      preferredVisitStartTime: "14:00",
      preferredVisitEndTime: "16:00",
      visitTimeType: "fixed",
    });

    expect(payload).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      preferredVisitStartTime: "14:00",
      preferredVisitEndTime: "16:00",
      visitTimeType: "fixed",
    });
  });

  it("throws 400 when create payload is not an object", () => {
    expect(() => validateCreatePatientPayload("bad")).toThrowError(HttpError);
    expect(() => validateCreatePatientPayload("bad")).toThrow("Request body must be a JSON object.");
  });

  it("throws 400 for invalid visitTimeType", () => {
    expect(() =>
      validateCreatePatientPayload({
        firstName: "Jane",
        lastName: "Doe",
        address: "123 Main St",
        preferredVisitStartTime: "14:00",
        preferredVisitEndTime: "16:00",
        visitTimeType: "sometimes",
      }),
    ).toThrow("visitTimeType must be one of: fixed, flexible.");
  });

  it("throws 400 for invalid time format", () => {
    expect(() =>
      validateCreatePatientPayload({
        firstName: "Jane",
        lastName: "Doe",
        address: "123 Main St",
        preferredVisitStartTime: "1400",
        preferredVisitEndTime: "16:00",
        visitTimeType: "fixed",
      }),
    ).toThrow("preferredVisitStartTime must use HH:MM 24-hour format.");
  });

  it("throws 400 when end time is not later than start", () => {
    expect(() => validateTimeWindow("16:00", "15:59")).toThrow(
      "preferredVisitEndTime must be later than preferredVisitStartTime (cross-midnight windows are not supported).",
    );
  });

  it("validates partial update payload", () => {
    const payload = validateUpdatePatientPayload({
      firstName: "  Jane  ",
      googlePlaceId: null,
      preferredVisitStartTime: "08:30",
      visitTimeType: "flexible",
    });

    expect(payload).toEqual({
      firstName: "Jane",
      googlePlaceId: null,
      preferredVisitStartTime: "08:30",
      visitTimeType: "flexible",
    });
  });

  it("keeps trimmed non-empty optional strings on update", () => {
    const payload = validateUpdatePatientPayload({ googlePlaceId: "  place-123  " });
    expect(payload).toEqual({ googlePlaceId: "place-123" });
  });

  it("throws 400 for invalid optional update field types", () => {
    expect(() => validateUpdatePatientPayload({ googlePlaceId: 123 })).toThrow(
      "googlePlaceId must be a string when provided.",
    );
  });

  it("throws 400 when update payload is not an object", () => {
    expect(() => validateUpdatePatientPayload(null)).toThrow("Request body must be a JSON object.");
  });

  it("throws required-field errors for empty update strings", () => {
    expect(() => validateUpdatePatientPayload({ lastName: "   " })).toThrow("lastName is required.");
    expect(() => validateUpdatePatientPayload({ address: "   " })).toThrow("address is required.");
  });

  it("validates provided end-time format during update", () => {
    expect(() => validateUpdatePatientPayload({ preferredVisitEndTime: "25:00" })).toThrow(
      "preferredVisitEndTime must use HH:MM 24-hour format.",
    );
  });

  it("validates visitTimeType when provided in update", () => {
    expect(() => validateUpdatePatientPayload({ visitTimeType: "invalid" })).toThrow(
      "visitTimeType must be one of: fixed, flexible.",
    );
  });
});
