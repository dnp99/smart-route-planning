import bcrypt from "bcryptjs"
import postgres from "postgres"
import { pathToFileURL } from "node:url"

const SALT_ROUNDS = 12

export const DEFAULT_LEGACY_NURSE_EXTERNAL_KEY = "default-nurse"

export class LegacyNurseBootstrapError extends Error {}

const readOptionalEnvString = (env, name) => {
  const rawValue = env[name]
  if (typeof rawValue !== "string") {
    return null
  }

  const trimmedValue = rawValue.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

const requireEnvString = (env, name, message) => {
  const value = readOptionalEnvString(env, name)
  if (!value) {
    throw new LegacyNurseBootstrapError(message)
  }

  return value
}

const normalizeEmail = (value) => value.trim().toLowerCase()

export const resolveLegacyNurseBootstrapConfig = (env = process.env) => {
  const databaseUrl = requireEnvString(
    env,
    "DATABASE_URL",
    "DATABASE_URL is required to bootstrap the legacy nurse.",
  )
  const email = normalizeEmail(
    requireEnvString(
      env,
      "LEGACY_NURSE_EMAIL",
      "LEGACY_NURSE_EMAIL is required to bootstrap the legacy nurse.",
    ),
  )
  const password = requireEnvString(
    env,
    "LEGACY_NURSE_PASSWORD",
    "LEGACY_NURSE_PASSWORD is required to bootstrap the legacy nurse.",
  )

  if (password.length < 8) {
    throw new LegacyNurseBootstrapError("LEGACY_NURSE_PASSWORD must be at least 8 characters.")
  }

  return {
    databaseUrl,
    externalKey:
      readOptionalEnvString(env, "LEGACY_NURSE_EXTERNAL_KEY") ?? DEFAULT_LEGACY_NURSE_EXTERNAL_KEY,
    email,
    password,
    displayName: readOptionalEnvString(env, "LEGACY_NURSE_DISPLAY_NAME"),
  }
}

export const createLegacyNurseBootstrapRepository = (sql) => ({
  findNurseByExternalKey: async (externalKey) => {
    const rows = await sql`
      select
        id,
        external_key as "externalKey",
        display_name as "displayName",
        email,
        is_active as "isActive"
      from nurses
      where external_key = ${externalKey}
      limit 1
    `

    return rows[0] ?? null
  },
  findNurseByNormalizedEmail: async (email) => {
    const rows = await sql`
      select
        id,
        external_key as "externalKey"
      from nurses
      where email is not null
        and lower(email) = lower(${email})
      limit 1
    `

    return rows[0] ?? null
  },
  updateLegacyNurseAuth: async ({ id, displayName, email, passwordHash }) => {
    const rows = await sql`
      update nurses
      set
        display_name = ${displayName},
        email = ${email},
        password_hash = ${passwordHash},
        is_active = true,
        updated_at = now()
      where id = ${id}
      returning
        id,
        external_key as "externalKey",
        display_name as "displayName",
        email,
        is_active as "isActive"
    `

    return rows[0] ?? null
  },
})

const defaultHashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS)

export const bootstrapLegacyNurse = async (
  repository,
  config,
  { hashPassword = defaultHashPassword } = {},
) => {
  const targetNurse = await repository.findNurseByExternalKey(config.externalKey)
  if (!targetNurse) {
    throw new LegacyNurseBootstrapError(
      `Legacy nurse with external key "${config.externalKey}" was not found.`,
    )
  }

  const emailOwner = await repository.findNurseByNormalizedEmail(config.email)
  if (emailOwner && emailOwner.id !== targetNurse.id) {
    throw new LegacyNurseBootstrapError(
      `Email "${config.email}" is already assigned to a different nurse.`,
    )
  }

  const passwordHash = await hashPassword(config.password)
  const nextDisplayName = config.displayName ?? targetNurse.displayName
  const updatedNurse = await repository.updateLegacyNurseAuth({
    id: targetNurse.id,
    displayName: nextDisplayName,
    email: config.email,
    passwordHash,
  })

  if (!updatedNurse) {
    throw new LegacyNurseBootstrapError(
      `Failed to update legacy nurse "${config.externalKey}" during bootstrap.`,
    )
  }

  return updatedNurse
}

export const formatLegacyNurseBootstrapSummary = (nurse) =>
  `Bootstrapped legacy nurse ${nurse.id} (${nurse.externalKey}) with email ${nurse.email}.`

export const runLegacyNurseBootstrapCli = async (env = process.env) => {
  const config = resolveLegacyNurseBootstrapConfig(env)
  const sql = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
  })

  try {
    const repository = createLegacyNurseBootstrapRepository(sql)
    const nurse = await bootstrapLegacyNurse(repository, config)
    console.log(formatLegacyNurseBootstrapSummary(nurse))
    return nurse
  } finally {
    await sql.end()
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  try {
    await runLegacyNurseBootstrapCli()
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Failed to bootstrap the legacy nurse account.",
    )
    process.exitCode = 1
  }
}
