import { describe, expect, it } from "vitest";
import { HttpError } from "../../../lib/http";
import { parseAndValidateBody } from "./validation";

const expectHttpError = (
  fn: () => unknown,
  status: number,
  message: string,
) => {
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
  it("returns trimmed and deduplicated addresses", () => {
    const payload = parseAndValidateBody({
      startAddress: "  Start Address  ",
      endAddress: "  End Address  ",
      addresses: ["  Stop One  ", "Stop One", "", "Stop Two"],
    });

    expect(payload).toEqual({
      startAddress: "Start Address",
      endAddress: "End Address",
      addresses: ["Stop One", "Stop Two"],
    });
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
        addresses: [],
      }),
      400,
      "Please provide a starting point.",
    );
  });

  it("throws HttpError when addresses is not an array of strings", () => {
    expectHttpError(
      () =>
      parseAndValidateBody({
        startAddress: "Start",
        endAddress: "End",
        addresses: ["valid", 123],
      }),
      400,
      "addresses must be an array of strings.",
    );
  });

  it("throws when startAddress is not a string", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: 123,
          endAddress: "End",
          addresses: [],
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
          addresses: [],
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
          addresses: [],
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
          addresses: [],
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
          addresses: [],
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
          addresses: Array.from({ length: 26 }, (_, index) => `Stop ${index}`),
        }),
      400,
      "Please provide at most 25 destination addresses.",
    );
  });

  it("throws when any destination address is too long", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          startAddress: "Start",
          endAddress: "End",
          addresses: ["short", "D".repeat(201)],
        }),
      400,
      "Each destination must be at most 200 characters.",
    );
  });
});
