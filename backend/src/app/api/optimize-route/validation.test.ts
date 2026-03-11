import { describe, expect, it } from "vitest";
import { HttpError } from "../../../lib/http";
import { parseAndValidateBody } from "./validation";

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
    try {
      parseAndValidateBody({
        startAddress: "   ",
        endAddress: "End",
        addresses: [],
      });
      throw new Error("Expected parseAndValidateBody to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe("Please provide a starting point.");
    }
  });

  it("throws HttpError when addresses is not an array of strings", () => {
    try {
      parseAndValidateBody({
        startAddress: "Start",
        endAddress: "End",
        addresses: ["valid", 123],
      });
      throw new Error("Expected parseAndValidateBody to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe("addresses must be an array of strings.");
    }
  });
});
