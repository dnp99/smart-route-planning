# Account Settings + Home Address + Working Hours Execution Plan

## Status

- In progress
- Phase 1: Implemented
- Phase 2: Implemented
- Phase 3: Implemented
- Phase 4: Pending
- Last updated: 2026-03-18

## Objective

Add an account menu in the main header that includes:

- Account settings
- Logout

Account settings will support:

- View current nurse email (read-only)
- Add/update home address
- Update password (current password + new password + confirm new password)

Future scope:

- Add 7-day working-hours schedule in account settings
- Use working-hours schedule in optimize-route-v2, especially for flexible visits with no preferred windows

## Scope

### In scope (Phase 1)

- Replace single logout trigger behavior with a generic options/menu trigger in header.
- Add account settings modal accessible from the menu.
- Add nurse home-address management in account settings.
- Use saved home address as default Route Planner start and end point.
- Preserve existing logout behavior via menu item.

### In scope (Future Phase 2)

- Add weekly working-hours configuration for nurse account.
- Integrate schedule constraints into optimize-route-v2 planning.

### Out of scope

- Redesign of login/signup screens.
- Role/permission model changes beyond current nurse account context.
- Multi-timezone workforce scheduling.

## UX Requirements

### Header menu

- Keep current top-right icon trigger location.
- Change semantics from "logout menu" to "account options menu".
- Menu items (order):

1. `Account settings`
2. `Logout`

### Account settings modal

- Fields:
  - Email (read-only)
  - Home address (editable)
- Actions:
  - `Cancel`
  - `Save`
- Error messaging:
  - Inline and specific for profile validation failures.
- Success messaging:
  - Clear confirmation and modal close or reset behavior.
- Security section:
  - Password update form with current password, new password, confirm new password.

## Implementation Update (2026-03-18)

### Completed

1. Account options menu is live in header with `Account settings` and `Logout`.
2. Account settings modal is implemented with:
   - nurse email (read-only)
   - editable home address
   - validation + save feedback
3. Auth profile API now supports:
   - `GET /api/auth/me` returning `homeAddress`
   - `PATCH /api/auth/me` for home-address updates
4. Route Planner now defaults both start/end from saved home address when:
   - no trip draft overrides exist
   - fields are empty/default
5. Draft precedence and manual override behavior are preserved.
6. `POST /api/auth/update-password` is live with full validation, rate limiting, and bcrypt verification.
7. Account settings modal security section now shows a live password update form.
8. Password fields include show/hide toggle and confirm-field match indicator.

### Remaining

1. Phase 4: weekly working-hours schedule + optimize-route-v2 integration.

### Home address + planner default behavior

1. Nurse can save a single home address from account settings.
2. Route Planner uses saved home address as default for both:
   - starting point
   - ending point
3. Nurse can still override start/end for a specific plan without changing account home address.
4. If no home address exists, current manual start/end behavior remains unchanged.
5. Existing trip draft state (if present) takes precedence over auto-default fill.

## API Contract — Profile Update (Phase 1)

### Profile endpoint

- `PATCH /api/auth/me` (profile update)

### Profile request body

```json
{
  "homeAddress": "string"
}
```

### Profile response shape addition

- Include `homeAddress` in `GET /api/auth/me` authenticated profile payload.

### Profile validation

- Non-empty string after trim.
- Max length consistent with route input validation boundaries.
- Reject invalid payload types.

### Profile auth

- Requires valid auth cookie/session token, same as existing `/api/auth/me`.

### Profile response codes

- `200` success
- `400` invalid payload
- `401` unauthenticated
- `500` server error

## API Contract — Password Update (Phase 3)

### Password endpoint

- `POST /api/auth/update-password`

### Password request body

```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### Password auth

- Requires valid auth cookie/session token, same as `/api/auth/me`.

### Password response

- `200` success:

```json
{ "success": true }
```

- `400` validation failure (missing fields, weak new password, no-op change)
- `401` unauthenticated
- `403` current password mismatch
- `429` rate limited
- `500` server error

### Password security requirements

- Verify current password using existing password verification helper.
- Re-hash and persist with existing password hashing helper.
- Reject no-op password change (`newPassword === currentPassword`).
- Apply same request guards and audit logging standards already used in auth routes.
- Never return raw password-related details in logs.

## Working Hours Model (Future Phase 4)

### Data shape (proposed)

```ts
type WeeklyWorkingHours = {
  monday?: { enabled: boolean; start: string; end: string };
  tuesday?: { enabled: boolean; start: string; end: string };
  wednesday?: { enabled: boolean; start: string; end: string };
  thursday?: { enabled: boolean; start: string; end: string };
  friday?: { enabled: boolean; start: string; end: string };
  saturday?: { enabled: boolean; start: string; end: string };
  sunday?: { enabled: boolean; start: string; end: string };
};
```

Time format: `HH:mm` in nurse timezone.

### Account settings UX (future)

- Weekday rows with:
  - enabled toggle
  - start time
  - end time
- Validation:
  - end must be after start
  - at least one day enabled

## Optimize Route Integration (Future Phase 4)

### Behavioral rules

1. Resolve working window from `planningDate` weekday.
2. If day is disabled, block optimize with actionable error.
3. For flexible visits without preferred windows:
   - derive effective visit window from nurse working window.
4. For mixed visits:
   - fixed/preferred windows remain explicit constraints.
   - no-preferred-window visits inherit working window.
5. If route spills past working hours:
   - keep result if optimizer can still produce sequence.
   - show warning such as `Outside working hours by X min`.

### Priority order

1. Hard constraints (fixed windows, explicit visit constraints)
2. Nurse working-hours bounds
3. Distance/travel efficiency

## Implementation Phases

### Phase 1: Account menu + account settings modal foundation

- Frontend:
  - update header menu labels/ARIA semantics
  - add account settings modal with profile + security sections
- Backend:
  - keep current auth profile read endpoint as baseline integration source
- Acceptance criteria:
  - nurse can open account settings from header menu
  - logout still works from same menu

### Phase 2: Home address profile + route planner defaults

- Backend:
  - add profile update support for `homeAddress` (`PATCH /api/auth/me`)
  - include `homeAddress` in `GET /api/auth/me` response contract
- Frontend:
  - add editable home-address field in account settings
  - load profile home address and persist updates
  - prefill Route Planner start/end from saved home address when trip inputs are empty
- Acceptance criteria:
  - nurse can save home address in account settings
  - Route Planner auto-fills start and end with saved home address
  - nurse can override trip start/end without modifying saved home address

### Phase 3: Password update flow

- Backend:
  - add `POST /api/auth/update-password` endpoint
  - add route tests for success/failure/rate-limit/auth cases
- Frontend:
  - add password update form validation and API call in account settings
  - show/hide toggle on all password fields
  - confirm password field match indicator (green/red border)
- Acceptance criteria:
  - nurse can update password with correct current password
  - nurse gets precise validation errors

### Phase 4: Weekly working-hours schedule + route integration

- Backend:
  - persist weekly working-hours on nurse profile
  - expose profile schedule read/write API
  - integrate schedule in optimize-route-v2 constraints
- Frontend:
  - add weekly schedule editor in account settings modal
  - show planner warnings/errors tied to working-hours constraints
- Acceptance criteria:
  - scheduler uses day-specific working window
  - no-preferred-window patients optimize without manual windows
  - unsupported plans show clear violation messaging

## Test Plan

### Frontend tests

- Header menu opens/closes and shows both items.
- Account settings modal open/close behavior.
- Home address field:
  - load existing value
  - save success and error handling
  - planner start/end default fill behavior
- Password form validation coverage:
  - missing fields
  - mismatch
  - weak password
  - API error handling

### Backend tests

- `PATCH /api/auth/me` profile update:
  - success path
  - unauthenticated request
  - invalid home address payload
- `POST /api/auth/update-password`:
  - success path
  - unauthenticated request
  - current password mismatch
  - weak password rejection
  - no-op change rejection
  - rate-limit behavior

### Future integration tests

- optimize-route-v2 with:
  - all flexible/no preferred windows
  - mixed fixed + flexible visits
  - route exceeding working hours

## Rollout Notes

- Deliver Phase 1 and Phase 2 first so nurses get home-base defaults in Route Planner before weekly schedule work.
- Deliver Phase 3 after profile baseline is in place.
- Gate Phase 4 behind schema + API readiness.
- Update `plans/change-log.md` after each completed phase.
