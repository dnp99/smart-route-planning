## Decisions

- Chosen ORM/persistence stack: Drizzle ORM + `postgres` client with schema in `backend/src/db/schema.ts`, SQL migration committed under `backend/src/db/migrations`, and idempotent default nurse seed script (`seed-default-nurse.ts`).
- Locked env gate behavior implemented in `resolveNurseContext`: enforce `DATABASE_URL`, require `DEFAULT_NURSE_POC === 'true'`, require `DEFAULT_NURSE_ID`, and resolve runtime nurse ownership strictly by `nurses.external_key`.
- Patient PATCH validation strategy: allow partial updates, validate only provided fields at request parse time, then validate merged time-window ordering (`end > start`, no cross-midnight) before DB update.
