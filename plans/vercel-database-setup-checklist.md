# Vercel Database Setup Checklist

Date noted: 2026-03-12

Use this checklist when enabling the patient-management backend in a deployed environment.

## Goal

Provision the production database connection for CareFlow so deployed patient CRUD can work on Vercel.

## Checklist

### 1. Create the database

- Create a Postgres database for the deployed environment.
- Preferred direction from the execution plan:
  - Neon Postgres

## 2. Collect connection details

- Copy the Postgres connection string.
- Confirm it is the runtime connection string intended for the Vercel backend.

## 3. Configure Vercel environment variables

Set these variables in the Vercel project:

- `DATABASE_URL`
- `DEFAULT_NURSE_POC=true`
- `DEFAULT_NURSE_ID=default-nurse`
- `GOOGLE_MAPS_API_KEY`
- `ALLOWED_ORIGINS`

Optional variables if used:

- `OPTIMIZE_ROUTE_API_KEY`
- `OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS`
- `OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS`
- `NOMINATIM_CONTACT_EMAIL`

## 4. Apply the database schema

- Run the committed Drizzle migration(s) against the target database.
- Confirm these tables exist:
  - `nurses`
  - `patients`

## 5. Ensure default nurse exists

- Confirm the default nurse row exists with:
  - `external_key = 'default-nurse'`
- If needed, run the seed flow or insert it manually once.

## 6. Deploy and verify

After env vars and schema are ready:

- trigger a Vercel deployment
- verify `GET /api/patients` no longer returns config errors
- verify patient create/list/update/delete works in the deployed UI

## 7. Smoke-test checklist

- open deployed `/patients`
- confirm the page loads without `DATABASE_URL` configuration errors
- create a patient
- search for that patient
- edit the patient
- delete the patient
- verify route-planner patient search can see the saved patient

## Notes

- Do not point casual local development at the production database unless explicitly needed.
- Prefer a separate dev/staging database before using production data.
- The remaining execution-plan gaps are tracked separately in:
  - `plans/nurse-patient-management-follow-ups.md`
