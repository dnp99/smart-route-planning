import { describe, expect, it } from "vitest";
import { HttpError } from "../../../lib/http";
import { parseAndValidateBody } from "./validation";

const expectHttpError = (fn: () => unknown, status: number, message: string) => {
  try {
    fn();
    throw new Error("Expected function to throw HttpError");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).message).toBe(message);
  }
};

describe("parseAndValidateBody", () => {
  it("returns normalized destinations from patient destination payload", () => {
    const payload = parseAndValidateBody({
      startAddress: "Start Address",
      endAddress: "End Address",
      destinations: [
        {
          patientId: " patient-1 ",
          patientName: " Jane Doe ",
          address: " 100 Main St ",
          googlePlaceId: "  place-1 ",
        },
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "100 Main St",
        },
      ],
    });

    expect(payload).toEqual({
      startAddress: "Start Address",
      endAddress: "End Address",
      destinations: [
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "100 Main St",
          googlePlaceId: "place-1",
        },
      ],
    });
  });

  it("normalizes manual start and end place ids", () => {
    const payload = parseAndValidateBody({
      startAddress: "Start Address",
      startGooglePlaceId: "  start-place  ",
      endAddress: "End Address",
      endGooglePlaceId: "  end-place  ",
      destinations: [],
    });

    expect(payload).toEqual({
      startAddress: "Start Address",
      startGooglePlaceId: "start-place",
      endAddress: "End Address",
      endGooglePlaceId: "end-place",
      destinations: [],
    });
  });

  it("keeps same-address destinations when patient ids differ", () => {
    const payload = parseAndValidateBody({
      startAddress: "Start Address",
      endAddress: "End Address",
      destinations: [
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "100 Main St",
        },
        {
          patientId: "patient-2",
          patientName: "John Doe",
          address: "100 Main St",
        },
      ],
    });

    expect(payload.destinations).toHaveLength(2);
  });

  it("throws when destinations is missing", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
        }),
      400,
      "destinations must be an array.",
    );
  });

  it("throws HttpError for invalid body shape", () => {
    expect(() => parseAndValidateBody(null)).toThrowError("Invalid request body.");
  });

  it("throws HttpError with status for missing starting point", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "   ",
          endAddress: "End",
          destinations: [],
        }),
      400,
      "Please provide a starting point.",
    );
  });

  it("throws when destinations is not an array", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          destinations: "invalid",
        }),
      400,
      "destinations must be an array.",
    );
  });

  it("throws when startAddress is not a string", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: 123,
          endAddress: "End",
          destinations: [],
        }),
      400,
      "startAddress must be a string.",
    );
  });

  it("throws when endAddress is not a string", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: 123,
          destinations: [],
        }),
      400,
      "endAddress must be a string.",
    );
  });

  it("throws when ending point is blank", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "   ",
          destinations: [],
        }),
      400,
      "Please provide an ending point.",
    );
  });

  it("throws when starting point is too long", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "S".repeat(201),
          endAddress: "End",
          destinations: [],
        }),
      400,
      "Starting point must be at most 200 characters.",
    );
  });

  it("throws when ending point is too long", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "E".repeat(201),
          destinations: [],
        }),
      400,
      "Ending point must be at most 200 characters.",
    );
  });

  it("throws when there are more than 25 destination addresses", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          destinations: Array.from({ length: 26 }, (_, index) => ({
            patientId: `patient-${index}`,
            patientName: `Patient ${index}`,
            address: `Stop ${index}`,
          })),
        }),
      400,
      "Please provide at most 25 destinations.",
    );
  });

  it("throws when any destination address is too long", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          destinations: [
            {
              patientId: "patient-1",
              patientName: "Jane Doe",
              address: "short",
            },
            {
              patientId: "patient-2",
              patientName: "John Doe",
              address: "D".repeat(201),
            },
          ],
        }),
      400,
      "Each destination address must be at most 200 characters.",
    );
  });

  it("throws when destination patientId is missing", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          destinations: [
            {
              patientName: "Jane Doe",
              address: "100 Main St",
            },
          ],
        }),
      400,
      "destinations[0].patientId must be a string.",
    );
  });

  it("throws when destination patientName is missing", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          destinations: [
            {
              patientId: "patient-1",
              address: "100 Main St",
            },
          ],
        }),
      400,
      "destinations[0].patientName must be a string.",
    );
  });

  it("throws when destination googlePlaceId has invalid type", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          destinations: [
            {
              patientId: "patient-1",
              patientName: "Jane Doe",
              address: "100 Main St",
              googlePlaceId: 123,
            },
          ],
        }),
      400,
      "destinations[0].googlePlaceId must be a string when provided.",
    );
  });

  it("throws when startGooglePlaceId has invalid type", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          startGooglePlaceId: 123,
          endAddress: "End",
          destinations: [],
        }),
      400,
      "startGooglePlaceId must be a string when provided.",
    );
  });

  it("throws when endGooglePlaceId has invalid type", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          endGooglePlaceId: 123,
          destinations: [],
        }),
      400,
      "endGooglePlaceId must be a string when provided.",
    );
  });
});
