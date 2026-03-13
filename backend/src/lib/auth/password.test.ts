import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("auth password helpers", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("secret-password");

    await expect(verifyPassword("secret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
