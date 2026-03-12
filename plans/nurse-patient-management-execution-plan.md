# Nurse Patient Management Plan

## Objective

Add patient management to the route planner so a nurse can save, search, and update a list of patients, then use selected patients as route-planning destinations.

For this POC:

- there is only one nurse
- login/authentication is not required
- patient data still needs to be stored in a way that can later support nurse-specific ownership

## User Requirements

The nurse should be able to maintain a patient list with:

- first name
- last name
- address
- preferred visitation time window
- visit-time flexibility:
  - `fixed`
  - `flexible`

The nurse should also be able to:

- search patients by name in the UI
- edit and update an existing patient
- persist the patient list across sessions

## Current State

- The application optimizes routes from manually entered addresses.
- There is no patient entity in the frontend or backend.
- There is no persisted application data store for saved patients.
- There is no nurse identity model today.

## Target Outcome

After this phase:

- the app has a stored patient list for the POC nurse
- each patient record includes name, address, preferred visit time window, and flexibility mode
- the UI supports patient search by name
- the UI supports creating and updating patient records
- the route planner can select patients and use their saved addresses as route destinations
- patient records can later be associated with multiple nurses without redesigning the data model

## Scope

### In scope

- introduce a patient data model
- persist patient records
- support one default nurse for the POC
- add backend CRUD endpoints needed for patient listing, creation, update, and delete
- add frontend patient-management UI for search and edit flows
- add frontend navigation between patient management and route planning
- use Google Places autocomplete for patient address entry
- allow route planning to select patients as destinations instead of manually typing destination addresses
- document the storage approach and future multi-nurse path

### Out of scope

- nurse login or authentication
- nurse self-service registration
- authorization rules between multiple nurses
- route optimization changes that use preferred visit times as scheduling constraints

## Recommended Data Model

### Nurse

For the POC, keep a single default nurse record while designing for future expansion.

Suggested fields:

- `id`
- `displayName`
- `createdAt`
- `updatedAt`

Recommended POC behavior:

- seed or assume one nurse with a stable ID such as `default-nurse`

### Patient

Suggested fields:

- `id`
- `nurseId`
- `firstName`
- `lastName`
- `address`
- `preferredVisitStartTime`
- `preferredVisitEndTime`
- `visitTimeType`
- `createdAt`
- `updatedAt`

Recommended enum:

- `visitTimeType = "fixed" | "flexible"`

Notes:

- preferred visitation should be modeled as a time window, for example `14:00` to `16:00`.
- store the window in normalized time-of-day values such as `"14:00"` and `"16:00"`.
- `fixed` means the visit should be treated as time-bound later when scheduling logic is introduced.
- `flexible` means the nurse prefers that window but the visit can be scheduled with more latitude in a later scheduling phase.

## Storage Plan

### Recommended POC direction

Use a small persistent backend data store rather than browser-only storage.

Recommended deployed database:

1. Neon Postgres

Recommended local-development option:

1. Neon Postgres for parity

Why backend persistence is the better default:

- data remains tied to the application instead of one browser
- easier path to future multi-nurse support
- easier path to future scheduling features

Why Neon is the recommended deployed choice:

- works well with the current Vercel-hosted backend
- low-friction connection model for a small POC
- cheaper starting point than many alternatives
- relational Postgres model fits nurse/patient ownership cleanly
- leaves a straightforward path to future multi-nurse support

## Locked Database Schema

This plan assumes Neon-hosted Postgres as the source of truth for persisted nurse and patient data.

### Table: `nurses`

Purpose:

- stores nurse ownership context for patient records
- supports the current single-nurse POC while remaining compatible with future multi-nurse auth

Locked columns:

- `id uuid primary key`
- `external_key text unique not null`
- `display_name text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Locked constraints:

- `external_key` must be unique

POC seed direction:

- seed one row with:
  - `external_key = 'default-nurse'`
  - `display_name = 'Default Nurse'`

### Table: `patients`

Purpose:

- stores patient records owned by a nurse
- stores routing-relevant patient address data
- stores visit preference window and flexibility type

Locked columns:

- `id uuid primary key`
- `nurse_id uuid not null references nurses(id) on delete cascade`
- `first_name text not null`
- `last_name text not null`
- `address text not null`
- `google_place_id text`
- `preferred_visit_start_time time not null`
- `preferred_visit_end_time time not null`
- `visit_time_type text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Locked constraints:

- check `visit_time_type in ('fixed', 'flexible')`
- check `preferred_visit_end_time > preferred_visit_start_time`
- hard delete is allowed in phase 1

Locked index plan:

- index on `patients(nurse_id)`
- index on `patients(nurse_id, last_name, first_name)`
- trigram or equivalent substring-search index on patient name fields if search performance becomes necessary

Locked search model:

- search is scoped by `nurse_id`
- search applies case-insensitive substring matching to:
  - `first_name`
  - `last_name`
- duplicate names are allowed
- uniqueness is not enforced across patient names or addresses

### Address storage decision

Locked phase 1 approach:

- store the selected patient address as display text in `address`
- store `google_place_id` when available from Google Places autocomplete

Why:

- display text is required for UI rendering and route-planner output
- `google_place_id` gives a cleaner path to later address refresh or place-aware enhancements

### Time-window storage decision

Locked phase 1 approach:

- store preferred visit window as Postgres `time` columns:
  - `preferred_visit_start_time`
  - `preferred_visit_end_time`

Phase 1 rules:

- accepted UI format should normalize to 24-hour `HH:MM`
- cross-midnight visit windows are not allowed
- `fixed` and `flexible` share the same stored structure; only semantics differ

### Migration direction

Recommended migration steps:

1. create `nurses`
2. create `patients`
3. create indexes
4. seed the default nurse row for POC use

### ORM / query-layer direction

Recommended implementation direction:

- use a typed Postgres-friendly query layer or ORM that works cleanly with Neon and Vercel
- keep schema definitions and migrations in source control
- expose a small repository layer instead of coupling route handlers directly to SQL

### POC ownership model

Even without login, store each patient with a `nurseId`.

For now:

- enable a feature flag such as `DEFAULT_NURSE_POC`
- when the flag is enabled, resolve the nurse ID from an environment variable such as `DEFAULT_NURSE_ID`
- all patient CRUD requests run under that resolved nurse ID

Later:

- authentication can determine `nurseId` without changing the patient schema

## Backend Plan

### Locked backend environment contract

Phase 1 should introduce these backend environment variables:

- `DATABASE_URL`
  - required
  - Neon Postgres connection string
- `DEFAULT_NURSE_POC`
  - required for POC mode
  - expected values: `true` or `false`
- `DEFAULT_NURSE_ID`
  - required when `DEFAULT_NURSE_POC=true`
  - expected value: nurse `external_key`, for example `default-nurse`

Existing backend environment variables such as `GOOGLE_MAPS_API_KEY` and `ALLOWED_ORIGINS` remain in place.

Locked failure behavior:

- if `DATABASE_URL` is missing, patient endpoints should fail fast with server configuration error
- if `DEFAULT_NURSE_POC=true` and `DEFAULT_NURSE_ID` is missing, patient endpoints should fail fast with server configuration error
- if `DEFAULT_NURSE_POC=false`, patient endpoints should be treated as not yet supported until real nurse identity resolution exists

### Locked default nurse resolution behavior

Phase 1 nurse resolution should happen on the backend only.

Locked resolution rules:

1. read `DEFAULT_NURSE_POC`
2. if `DEFAULT_NURSE_POC !== 'true'`, reject patient requests as unsupported in the current environment
3. if `DEFAULT_NURSE_POC === 'true'`, read `DEFAULT_NURSE_ID`
4. resolve the nurse row by `nurses.external_key = DEFAULT_NURSE_ID`
5. use the resolved `nurses.id` as the ownership key for all patient queries and mutations

Locked behavior:

- the frontend does not send `nurseId`
- the backend owns all nurse scoping
- all patient CRUD requests are scoped to the resolved nurse record

### Locked ORM and migration direction

Recommended implementation direction is now locked for phase 1:

- use `Drizzle ORM`
- use SQL migrations committed to source control
- use Drizzle schema definitions as the source of truth for tables and indexes

Why this is locked:

- good TypeScript ergonomics for a Next.js backend
- works cleanly with Neon Postgres
- keeps schema and migrations explicit
- lighter operational surface than more complex ORM layers

### Locked backend module boundaries

Recommended backend structure should be treated as phase 1 implementation guidance:

- `backend/src/db/`
  - database client setup
  - Drizzle schema definitions
  - migration configuration
- `backend/src/lib/patients/`
  - patient repository
  - patient validation
  - nurse resolution helper
  - patient DTO / response shaping helpers
- `backend/src/app/api/patients/route.ts`
  - `GET`
  - `POST`
- `backend/src/app/api/patients/[id]/route.ts`
  - `PATCH`
  - `DELETE`

Locked separation rules:

- route handlers handle HTTP only
- nurse resolution happens in a reusable backend helper
- DB access goes through repository functions, not inline SQL in route handlers
- validation is centralized and shared across create/update flows

### Locked backend request lifecycle

For patient endpoints, phase 1 backend flow should be:

1. validate environment/configuration
2. resolve current nurse from POC configuration
3. validate request/query payload
4. execute repository operation scoped to resolved nurse
5. map result to locked API contract
6. return JSON response

### Locked backend search execution

Phase 1 search should execute on the backend, not purely in frontend memory.

Locked behavior:

- `GET /api/patients?query=...` performs the filtering in the database layer
- search is always scoped to the resolved nurse
- sort results by:
  1. `last_name asc`
  2. `first_name asc`
  3. `created_at asc`

### Locked seed strategy

Phase 1 should include an explicit seed path for the POC nurse.

Locked seed expectations:

- seed the default nurse during database setup or via a dedicated seed script
- seeding must be idempotent
- nurse lookup in runtime should assume the nurse row already exists

### Locked backend error handling

In addition to the generic error contract, patient endpoints should distinguish:

- configuration errors
- validation errors
- not-found errors
- database write/read failures

Recommended status mapping refinement:

- `400` invalid request payload or query
- `404` patient not found for resolved nurse
- `500` configuration or unexpected database/server error

### Locked backend testing expectations

Backend implementation should include tests for:

- nurse resolution from `DEFAULT_NURSE_POC` and `DEFAULT_NURSE_ID`
- create/list/update/delete patient handlers
- search query behavior
- duplicate-name handling
- validation for time-window rules
- ownership scoping by resolved nurse
- config failure paths when required env vars are missing

## Locked API Contracts

These contracts should be treated as the phase 1 source of truth for backend/frontend integration.

### Shared patient object

Locked response shape:

```json
{
  "id": "uuid",
  "nurseId": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "address": "123 Main St, Toronto, ON",
  "googlePlaceId": "ChIJ...",
  "preferredVisitStartTime": "14:00",
  "preferredVisitEndTime": "16:00",
  "visitTimeType": "fixed",
  "createdAt": "2026-03-12T12:00:00.000Z",
  "updatedAt": "2026-03-12T12:00:00.000Z"
}
```

### `GET /api/patients`

Purpose:

- list patients for the resolved nurse
- optionally filter by name search

Query params:

- `query` optional string

Locked behavior:

- if `query` is omitted or empty, return all patients for the current nurse
- if `query` is provided, apply case-insensitive substring search to first and last name only
- do not search by address in phase 1

Locked success response:

```json
{
  "patients": [
    {
      "id": "uuid",
      "nurseId": "uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "address": "123 Main St, Toronto, ON",
      "googlePlaceId": "ChIJ...",
      "preferredVisitStartTime": "14:00",
      "preferredVisitEndTime": "16:00",
      "visitTimeType": "fixed",
      "createdAt": "2026-03-12T12:00:00.000Z",
      "updatedAt": "2026-03-12T12:00:00.000Z"
    }
  ]
}
```

### `POST /api/patients`

Locked request body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "address": "123 Main St, Toronto, ON",
  "googlePlaceId": "ChIJ...",
  "preferredVisitStartTime": "14:00",
  "preferredVisitEndTime": "16:00",
  "visitTimeType": "fixed"
}
```

Locked success response:

- `201 Created`
- response body returns the created patient object

### `PATCH /api/patients/:id`

Locked request body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "address": "123 Main St, Toronto, ON",
  "googlePlaceId": "ChIJ...",
  "preferredVisitStartTime": "15:00",
  "preferredVisitEndTime": "17:00",
  "visitTimeType": "flexible"
}
```

Locked behavior:

- partial updates are allowed
- all provided fields must pass validation
- patient must belong to the resolved nurse

Locked success response:

- `200 OK`
- response body returns the updated patient object

### `DELETE /api/patients/:id`

Locked behavior:

- hard delete in phase 1
- patient must belong to the resolved nurse

Locked success response:

```json
{
  "deleted": true,
  "id": "uuid"
}
```

### Error response contract

Locked error shape for patient endpoints:

```json
{
  "error": "Human-readable error message"
}
```

Recommended status mapping:

- `400` invalid request payload or query
- `404` patient not found for the resolved nurse
- `409` optional future conflict handling if needed
- `500` unexpected server error

### Backend implementation notes

The exact patient endpoint contracts, validation rules, and module boundaries are locked in the sections above and should be treated as normative during implementation.

### Locked route-planner patient selection contract

Phase 1 route planning should preserve patient identity end to end through the optimize-route contract.

Locked frontend selected-patient shape:

```json
{
  "patientId": "uuid",
  "patientName": "Jane Doe",
  "address": "123 Main St, Toronto, ON",
  "googlePlaceId": "ChIJ..."
}
```

Locked optimize-route request strategy:

- optimize-route should be extended to accept destination metadata, not just raw destination address strings
- frontend sends selected-patient destination objects that preserve patient identity

Locked destination request object:

```json
{
  "patientId": "uuid",
  "patientName": "Jane Doe",
  "address": "123 Main St, Toronto, ON",
  "googlePlaceId": "ChIJ..."
}
```

Locked phase 1 optimize-route request example:

```json
{
  "startAddress": "Nurse Home Base",
  "endAddress": "Nurse Home Base",
  "destinations": [
    {
      "patientId": "patient-1",
      "patientName": "Jane Doe",
      "address": "123 Main St, Toronto, ON",
      "googlePlaceId": "ChIJ..."
    },
    {
      "patientId": "patient-2",
      "patientName": "John Doe",
      "address": "456 Queen St, Toronto, ON",
      "googlePlaceId": "ChIJ..."
    }
  ]
}
```

Locked result-mapping approach:

- backend optimization should preserve `patientId` and `patientName` with each reordered destination
- optimized response should return patient-linked stop metadata so frontend does not rely on address matching heuristics
- duplicate patient addresses must remain unambiguous because stop identity is carried by `patientId`

Locked response direction:

- existing routing logic may still optimize by address internally
- response contract should attach patient metadata to each optimized stop entry

Future-compatible direction:

- a later phase may also attach preferred time-window metadata per stop if scheduling constraints are introduced

### Locked shared optimize-route contract changes

Phase 1 should extend the shared optimize-route contract layer rather than introducing an unrelated nurse-only route contract.

Locked shared request shape direction:

- keep `startAddress`
- keep `endAddress`
- replace intermediate `addresses: string[]` with `destinations: OptimizeRouteDestination[]`

Locked shared request type:

```ts
type OptimizeRouteDestination = {
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
};

type OptimizeRouteRequest = {
  startAddress: string;
  endAddress: string;
  destinations: OptimizeRouteDestination[];
};
```

Locked shared request example:

```json
{
  "startAddress": "Nurse Home Base",
  "endAddress": "Nurse Home Base",
  "destinations": [
    {
      "patientId": "patient-1",
      "patientName": "Jane Doe",
      "address": "123 Main St, Toronto, ON",
      "googlePlaceId": "ChIJ..."
    },
    {
      "patientId": "patient-2",
      "patientName": "John Doe",
      "address": "456 Queen St, Toronto, ON",
      "googlePlaceId": "ChIJ..."
    }
  ]
}
```

Locked shared response shape direction:

- preserve existing top-level route summary fields where possible
- extend each optimized stop with patient-linked destination metadata
- preserve route-leg data already used by the current frontend

Locked shared optimized-stop type:

```ts
type OptimizeRouteOrderedStop = {
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
  latitude: number;
  longitude: number;
  distanceFromPreviousKm: number;
  durationFromPreviousSeconds: number;
  isEndingPoint: boolean;
};
```

Locked shared response type direction:

```ts
type OptimizeRouteResponse = {
  start: {
    address: string;
    latitude: number;
    longitude: number;
  };
  end: {
    address: string;
    latitude: number;
    longitude: number;
  };
  orderedStops: OptimizeRouteOrderedStop[];
  routeLegs: Array<{
    fromAddress: string;
    toAddress: string;
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
  }>;
  totalDistanceMeters: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
};
```

Locked response rules:

- every patient-linked stop must include `patientId` and `patientName`
- the final route endpoint may also be a patient destination in phase 1 if the selected trip design requires it
- `isEndingPoint` remains `true` only for the final route endpoint
- backend may reorder patient destinations, but the reordered stop entries must preserve the original patient identity fields

Locked final-end representation rule:

- when the final end is a patient-selected address, the response must still include the normal top-level `end`
- in that case, the final `orderedStops` entry should also carry that patient's `patientId`, `patientName`, and address with `isEndingPoint: true`
- when the final end is a manual address, the final `orderedStops` entry should not carry patient identity fields

Compatibility note:

- this is a breaking shared-contract change for optimize-route consumers
- frontend and backend optimize-route changes should be implemented atomically in the same phase

Recommended shared contract files to update during implementation:

- shared optimize-route request type
- shared optimize-route response type
- frontend optimize-route response parsing
- backend optimize-route request validation
- backend optimize-route response shaping

## Frontend Plan

### Locked routing approach

Phase 1 frontend routing should use a client-side router in the existing Vite React app.

Locked direction:

- add `react-router-dom`
- introduce two primary routes:
  - `/patients`
  - `/route-planner`
- make `/route-planner` the default landing route for backward compatibility
- keep a shared top-level app layout with navigation visible on both pages

### Patient management UI

Add a patient-management surface that supports:

- patient search input
- patient list/table/cards
- add patient form
- edit patient form or inline edit flow
- delete patient action

### Navigation

Add a simple app menu with:

1. `Patients` at `/patients`
2. `Route Planner` at `/route-planner`

Locked navigation behavior:

- active route should be visibly highlighted
- navigation should work on desktop and mobile
- page transitions do not need special animation in phase 1

### Locked page structure

#### `/patients`

This page should contain:

1. top navigation
2. patient search input
3. patient list panel
4. patient form panel

Recommended desktop layout:

- two-column layout
- left column for search + patient list
- right column for create/edit form

Recommended mobile layout:

- stacked layout
- search and list first
- form below

#### `/route-planner`

This page should contain:

1. top navigation
2. existing route-planner controls
3. patient search/select area for destinations
4. selected patient destination list
5. optimized route results and map

Locked phase 1 behavior:

- start address remains manual
- end can be either:
  - a manual address, or
  - a selected patient's address
- destination selection should come from saved patients
- manual free-text destination entry should no longer be the primary patient workflow

### Locked end-point UX

The route planner should expose an explicit end-mode choice.

Locked end-mode options:

1. `Manual end address`
2. `Patient end address`

Locked UI behavior:

- default end mode is `Manual end address`
- the nurse can switch end mode at any time before optimize

#### Manual end address mode

- show the existing end-address input with Google Places autocomplete support if already available in the route planner flow
- nurse types or selects the final end address manually
- no patient metadata is attached to the end point in this mode

#### Patient end address mode

- hide or disable the manual end-address input
- show a patient search/select control dedicated to the final end point
- selected end patient should display:
  - patient name
  - patient address
  - clear/change action

Locked selection rules:

- the end patient selector is separate from the destination patient selector
- selecting a patient as the final end point does not automatically add that patient to intermediate destinations
- a patient already selected as the final end point cannot also remain in the intermediate destination list
- if the nurse promotes an already-selected destination patient to final end, that patient must be removed from intermediate destinations
- clearing the end patient in patient-end mode leaves no end selected until the nurse picks another patient or switches back to manual mode

Locked validation rules:

- optimize is blocked until a valid final end is present
- in manual mode, `endAddress` must be non-empty
- in patient-end mode, an end patient must be selected

Locked request behavior:

- when manual mode is active, `endAddress` is submitted from the manual end field
- when patient-end mode is active, `endAddress` is derived from the selected end patient's address
- patient-linked `destinations[]` should contain intermediate selected patients only, not the final end patient
- the final end address may also be a patient destination if the implementation later chooses to support that route shape explicitly

### Locked Patients page flow

#### Search flow

- page loads the patient list for the current nurse
- search input filters by first and last name substring
- empty search restores the full list
- results should update as the user types, with debounce if needed during implementation

#### Create flow

- default form mode is `create`
- submitting a valid form creates the patient
- after create:
  - list refreshes
  - newly created patient appears in the list
  - form resets back to empty create state

#### Edit flow

- selecting a patient from the list switches the form into `edit` mode
- form loads the selected patient values
- save updates that patient
- after save:
  - list refreshes
  - edited patient remains selected

#### Delete flow

- delete action is available only while editing a selected patient
- delete requires explicit confirmation
- after delete:
  - patient is removed from the list
  - form returns to `create` mode
  - selection clears

### Locked form behavior

Use one shared form component for both create and edit.

Locked fields:

- first name
- last name
- address with Google Places autocomplete
- preferred visit start time
- preferred visit end time
- visit time type

Locked form states:

- `create`
- `edit`
- `submitting`
- `error`

Locked validation display:

- field-level validation messages for invalid or missing inputs
- page-level error banner for request failures

### Locked patient list behavior

Each patient list row should show:

- full name
- address
- preferred time window
- fixed/flexible badge

Locked list behavior:

- selecting a row loads that patient into edit mode
- duplicate patient names are shown with address context
- empty-state message is shown when no patients exist or no matches are found

### Locked route-planner patient selection UX

Route planner should include a patient-selection area separate from start/end fields.

Locked behavior:

- nurse can search saved patients by name
- nurse can add one or more patients to the selected destination list
- selected patient chips/rows should show:
  - patient name
  - address
  - remove action
- selecting the same patient twice should be prevented in phase 1
- removing a selected patient should remove that destination from the optimize payload

Locked optimize behavior:

- optimize button submits patient-linked `destinations[]`
- optimize-route uses each destination's address for routing while preserving patient metadata
- result UI should show which stop maps to which selected patient deterministically in phase 1

### Required UI behavior

- user can search by first or last name
- user can open a patient record and update it
- user can distinguish fixed versus flexible visit-time patients
- user can delete a patient
- patient address entry should use Google Places autocomplete

### Suggested UX structure

1. Search bar at the top of the patient section
2. Patient list below search results
3. Form panel for add/edit
4. Make saved patients available for selection in route planning

## Route Planner Integration Direction

This requirement should include direct patient selection in route planning.

Recommended phase 1 behavior:

- the route planner should let the nurse search/select saved patients
- selected patients should populate the destination list
- the optimizer should use the selected patients' saved addresses through patient-linked destination objects
- the UI should still show which patient each selected destination belongs to
- the route planner should allow the final end point to be chosen either from manual entry or from a selected patient address

Not in this first plan:

- automatic route ordering based on fixed appointment times
- schedule feasibility checks
- time-window optimization
- replacing the start address field with patient selection unless requested later

### Route planner selection model

Recommended route-planning flow:

1. nurse searches/selects one or more saved patients
2. selected patients appear in the destination list
3. each selected destination carries:
   - patient ID
   - patient name
   - patient address
4. nurse chooses the final end point as either:
   - a manual end address, or
   - a selected patient address
5. backend optimize-route request receives patient-linked destination objects plus the resolved end address
6. backend uses destination addresses for optimization while preserving patient metadata in reordered output

Recommended compatibility approach:

- keep address-based routing internals if desired, but extend the request/response contract to carry patient-linked destination metadata
- return reordered stop data with patient identity preserved

Locked selected-address freshness rule:

- selected patient destinations in route-planner state should behave as snapshots captured at the time of selection
- if a patient record is edited later on `/patients`, existing route-planner selections do not auto-update in place
- nurse must reselect the patient to pick up the updated address or metadata

## Search And Update Behavior

### Search

Search should:

- use case-insensitive substring matching
- filter by first name
- filter by last name
- update results as the user types or on submit
- not require full-name combined search logic in phase 1
- route-planner patient selection should reuse the same name-search behavior

### Update

Editing a patient should:

- load the selected patient record into the form
- allow address and visitation settings to change
- persist changes immediately on explicit save
- refresh the list after save

### Delete

Deleting a patient should:

- require explicit user confirmation
- remove the patient from persisted storage
- refresh the list after delete

## Validation And Edge Cases

Handle:

- duplicate patient names
- incomplete addresses
- invalid time formats
- end time earlier than start time
- empty search query
- no matching patients
- patients with the same preferred time window but different flexibility
- selecting multiple patients with very similar names
- selected patient address changed before route submission

Recommended display behavior:

- show patient ID-independent labels using name + address snippet when duplicates exist
- in route planning, show patient name plus address so the nurse can confirm the correct selection

## Locked Testing And Acceptance Plan

### Backend automated tests

Phase 1 backend tests should cover:

- environment validation:
  - missing `DATABASE_URL`
  - missing `DEFAULT_NURSE_ID` when `DEFAULT_NURSE_POC=true`
- default nurse resolution:
  - resolves seeded nurse by `external_key`
  - fails when configured nurse does not exist
- patient create:
  - valid payload succeeds
  - invalid payload fails with `400`
- patient list:
  - returns all patients for resolved nurse
  - applies case-insensitive substring search on first and last name
  - does not leak patients belonging to another nurse
- patient update:
  - partial update succeeds
  - invalid time window fails
  - updating another nurse's patient returns `404`
- patient delete:
  - delete succeeds for current nurse
  - delete returns `404` for non-owned patient

### Frontend automated tests

Phase 1 frontend tests should cover:

- router behavior:
  - `/route-planner` renders route planner
  - `/patients` renders patient management page
  - navigation highlights the active route
- Patients page:
  - search filters by first/last name substring
  - create flow submits and resets correctly
  - edit flow loads selected patient into form
  - delete flow requires confirmation and refreshes list
  - duplicate names remain distinguishable by address
- patient form validation:
  - missing names rejected
  - invalid time window rejected
  - Google Places-backed address selection updates form state correctly
- Route Planner page:
  - patient search/select adds patients to selected destination list
  - duplicate patient selection is prevented
  - removing a selected patient updates destination state
  - optimize payload submits patient-linked `destinations[]`

### Integration tests

Phase 1 integration tests should cover:

- create patient -> search patient -> edit patient -> delete patient lifecycle
- patient created on `/patients` becomes available on `/route-planner`
- selected patient destinations are used in optimize-route submission
- optimized route UI retains patient context for selected stops deterministically in phase 1

### Manual acceptance checks

Required manual checks:

1. open `/patients`
2. create multiple patients, including duplicate names with different addresses
3. confirm Google Places address selection works in the patient form
4. search by first-name substring
5. search by last-name substring
6. edit a patient time window and confirm persistence
7. delete a patient and confirm removal
8. open `/route-planner`
9. search/select saved patients as destinations
10. confirm selected patient names and addresses appear before optimize
11. run route optimization and confirm saved patient addresses are used
12. confirm route results still map sensibly to selected patients

### CI verification expectations

At minimum, phase 1 implementation should pass:

- backend:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- frontend:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

### Deployment readiness checks

Before deployed rollout:

- confirm Neon connection works in deployed backend environment
- confirm seeded/default nurse row exists in deployed database
- confirm patient CRUD works against deployed backend
- confirm `/patients` and `/route-planner` both work in deployed frontend
- confirm route planning with selected saved patients works end to end

## Future Expansion Path

This plan should not block future features such as:

- real nurse accounts and authentication
- multiple nurses with separate patient lists
- scheduling constraints in route optimization
- patient notes or visit instructions
- recurring visit schedules

## Suggested Implementation Order

1. Define shared patient contracts and validation rules
2. Add backend persistence model with `nurseId`
3. Add feature-flagged default nurse resolution using env vars
4. Add patient CRUD/search endpoints, including delete
5. Add frontend menu and `/patients` plus `/route-planner` routes
6. Add patient search/list/create/edit/delete UI
7. Reuse Google Places autocomplete for patient address entry
8. Update route planner so destinations come from selected saved patients
9. Preserve patient-to-address mapping in the route-planning UI and results
10. Add documentation and locked test coverage

## Definition Of Done

This plan is complete when:

- patient records can be saved persistently
- each patient has name, address, preferred visit time window, and flexibility type
- the UI can search patients by first or last name substring
- the UI can update patient information
- the UI can delete patient information
- the app exposes `Patients` and `Route Planner` navigation routes
- the route planner can select saved patients and use their stored addresses as destinations
- for the POC, patient ownership is backend-controlled: all patient records are created, listed, updated, and deleted under the default nurse resolved from environment configuration
- automated and manual acceptance checks pass for patient CRUD and route-planner patient selection
- the implementation leaves a clean path for future multi-nurse support
