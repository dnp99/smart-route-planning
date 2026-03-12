import { afterEach, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./jwt";

describe("auth jwt helpers", () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalJwtExpiresIn = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }

    if (originalJwtExpiresIn === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalJwtExpiresIn;
    }
  });

  it("signs and verifies access tokens", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.JWT_EXPIRES_IN = "10m";

    const token = await signAccessToken({
      nurseId: "nurse-1",
      email: "nurse@example.com",
    });

    await expect(verifyAccessToken(token)).resolves.toEqual({
      sub: "nurse-1",
      email: "nurse@example.com",
    });
  });

  it("throws when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;

    await expect(
      signAccessToken({
        nurseId: "nurse-1",
        email: "nurse@example.com",
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: "Server is missing JWT_SECRET configuration.",
    });
  });

  it("rejects malformed token", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";

    await expect(verifyAccessToken("not-a-jwt-token")).rejects.toMatchObject({
      status: 401,
      message: "Missing or invalid authorization token.",
    });
  });
});
