import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_LEGACY_NURSE_EXTERNAL_KEY,
  LegacyNurseBootstrapError,
  bootstrapLegacyNurse,
  resolveLegacyNurseBootstrapConfig,
} from "../../scripts/bootstrap-legacy-nurse.mjs"

describe("legacy nurse bootstrap", () => {
  it("resolves config with normalized email and default external key", () => {
    const config = resolveLegacyNurseBootstrapConfig({
      DATABASE_URL: "postgres://example",
      LEGACY_NURSE_EMAIL: " Nurse@Example.com ",
      LEGACY_NURSE_PASSWORD: "secret123",
    })

    expect(config).toEqual({
      databaseUrl: "postgres://example",
      externalKey: DEFAULT_LEGACY_NURSE_EXTERNAL_KEY,
      email: "nurse@example.com",
      password: "secret123",
      displayName: null,
    })
  })

  it("throws when bootstrap email is missing", () => {
    expect(() =>
      resolveLegacyNurseBootstrapConfig({
        DATABASE_URL: "postgres://example",
        LEGACY_NURSE_PASSWORD: "secret123",
      }),
    ).toThrow("LEGACY_NURSE_EMAIL is required to bootstrap the legacy nurse.")
  })

  it("throws when bootstrap password is too short", () => {
    expect(() =>
      resolveLegacyNurseBootstrapConfig({
        DATABASE_URL: "postgres://example",
        LEGACY_NURSE_EMAIL: "nurse@example.com",
        LEGACY_NURSE_PASSWORD: "short",
      }),
    ).toThrow("LEGACY_NURSE_PASSWORD must be at least 8 characters.")
  })

  it("bootstraps the legacy nurse in place", async () => {
    const repository = {
      findNurseByExternalKey: vi.fn().mockResolvedValue({
        id: "nurse-1",
        externalKey: "default-nurse",
        displayName: "Default Nurse",
        email: null,
        isActive: true,
      }),
      findNurseByNormalizedEmail: vi.fn().mockResolvedValue(null),
      updateLegacyNurseAuth: vi.fn().mockResolvedValue({
        id: "nurse-1",
        externalKey: "default-nurse",
        displayName: "Default Nurse",
        email: "nurse@example.com",
        isActive: true,
      }),
    }
    const hashPassword = vi.fn().mockResolvedValue("hashed-password")

    const result = await bootstrapLegacyNurse(
      repository,
      {
        externalKey: "default-nurse",
        email: "nurse@example.com",
        password: "secret123",
        displayName: null,
      },
      { hashPassword },
    )

    expect(hashPassword).toHaveBeenCalledWith("secret123")
    expect(repository.updateLegacyNurseAuth).toHaveBeenCalledWith({
      id: "nurse-1",
      displayName: "Default Nurse",
      email: "nurse@example.com",
      passwordHash: "hashed-password",
    })
    expect(result).toEqual({
      id: "nurse-1",
      externalKey: "default-nurse",
      displayName: "Default Nurse",
      email: "nurse@example.com",
      isActive: true,
    })
  })

  it("allows re-running bootstrap for the same nurse email", async () => {
    const repository = {
      findNurseByExternalKey: vi.fn().mockResolvedValue({
        id: "nurse-1",
        externalKey: "default-nurse",
        displayName: "Default Nurse",
        email: "nurse@example.com",
        isActive: true,
      }),
      findNurseByNormalizedEmail: vi.fn().mockResolvedValue({
        id: "nurse-1",
        externalKey: "default-nurse",
      }),
      updateLegacyNurseAuth: vi.fn().mockResolvedValue({
        id: "nurse-1",
        externalKey: "default-nurse",
        displayName: "Renamed Nurse",
        email: "nurse@example.com",
        isActive: true,
      }),
    }

    await expect(
      bootstrapLegacyNurse(
        repository,
        {
          externalKey: "default-nurse",
          email: "nurse@example.com",
          password: "secret123",
          displayName: "Renamed Nurse",
        },
        { hashPassword: vi.fn().mockResolvedValue("hashed-password") },
      ),
    ).resolves.toEqual({
      id: "nurse-1",
      externalKey: "default-nurse",
      displayName: "Renamed Nurse",
      email: "nurse@example.com",
      isActive: true,
    })
  })

  it("rejects bootstrap when the legacy nurse row does not exist", async () => {
    const repository = {
      findNurseByExternalKey: vi.fn().mockResolvedValue(null),
      findNurseByNormalizedEmail: vi.fn(),
      updateLegacyNurseAuth: vi.fn(),
    }

    await expect(
      bootstrapLegacyNurse(
        repository,
        {
          externalKey: "default-nurse",
          email: "nurse@example.com",
          password: "secret123",
          displayName: null,
        },
        { hashPassword: vi.fn() },
      ),
    ).rejects.toEqual(
      new LegacyNurseBootstrapError(
        'Legacy nurse with external key "default-nurse" was not found.',
      ),
    )
  })

  it("rejects bootstrap when email belongs to a different nurse", async () => {
    const repository = {
      findNurseByExternalKey: vi.fn().mockResolvedValue({
        id: "nurse-1",
        externalKey: "default-nurse",
        displayName: "Default Nurse",
        email: null,
        isActive: true,
      }),
      findNurseByNormalizedEmail: vi.fn().mockResolvedValue({
        id: "nurse-2",
        externalKey: "another-nurse",
      }),
      updateLegacyNurseAuth: vi.fn(),
    }

    await expect(
      bootstrapLegacyNurse(
        repository,
        {
          externalKey: "default-nurse",
          email: "nurse@example.com",
          password: "secret123",
          displayName: null,
        },
        { hashPassword: vi.fn() },
      ),
    ).rejects.toEqual(
      new LegacyNurseBootstrapError(
        'Email "nurse@example.com" is already assigned to a different nurse.',
      ),
    )
  })
})
