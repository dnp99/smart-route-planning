# Route Advisor (Claude Haiku) — SHIPPED

## Status — implemented (local commits, `develop`)

Built end-to-end and committed locally (never pushed):

- **Backend:** `@anthropic-ai/sdk`; `lib/ai/claude.ts` (lazy singleton, `hasAnthropicKey`, `ROUTE_ADVISOR_MODEL = claude-haiku-4-5`); `lib/ai/routeAdvisor.ts` (translate-don't-optimize system prompt, forced tool call for a guaranteed `{ brief, suggestions }`, caps to 3); `lib/rateLimit/routeAdvisorRateLimit.ts` (best-effort per-nurse, 429 + Retry-After); `api/route-planner/advisor/route.ts` (OPTIONS + POST; auth, rate limit, 503 when unconfigured, 400 bad body/context, 502 on AI failure; audits aggregates only — never advice text or PHI).
- **Shared:** `shared/contracts/routeAdvisor.ts` — PHI-free `DeidentifiedRouteContext` + `RouteAdvisorResponse`, strict server-side guard + client parser.
- **Frontend:** `domain/buildRouteAdvisorContext.ts` (the single PHI boundary — aggregates + "Stop N" only, tested for no name/address/id leakage); `api/routePlannerService.ts` `requestRouteAdvice` + `RouteAdvisorUnavailableError` (503 → hidden); `hooks/useRouteAdvisor.ts` (request + cache-by-context, resets on route change); `ui/RouteAdvisorPanel.tsx` + tokens; wired controller → `RouteResultSection` → `OptimizedRouteResult` under the schedule summary.
- **Env/docs:** `ANTHROPIC_API_KEY` documented in `backend/README.md`, root `README.md`, `.env.local.example`. Absent key → 503 → panel hidden.

### Post-launch refinements (from live testing)
- Prompt: use the exact `windowType` from the data (no "fixed" vs "flexible/preferred" slips); cite only numbers present verbatim; no per-leg travel figures / routing-efficiency commentary (there is no per-leg data — it was hallucinating "168 km between Stop 2 and 3").
- Summary banner now counts any late visit (`lateBySeconds > 0`), matching the stop badges + advisor, instead of the coarse 15/60-min warning thresholds.
- Stop-card late label matches the window type ("Outside fixed/preferred window").
- **Advisor visibility gated to routes with issues** (`issueCount > 0`, or once advice is in flight/loaded) — on a clean route it just restated the green banner, so it's hidden there.

### Phase 2 (still out of scope)
"Suggest a reorder" — Haiku proposes an order, user Applies via the existing manual-reorder (`onMoveStop`) + Recalculate.

---

## Context

Add an AI **Route Advisor** to the Route Planner result: a short plain-English brief of the optimized route, plus plain-English explanations + concrete suggestions for the **warnings / unscheduled visits** the solver already produces. Pattern is lifted from the `the-block` repo (`/Users/deep./Desktop/Github/the-block`): a lazy Anthropic client, prompt builders, an in-memory rate limiter, and a thin Next.js API route that calls `claude-haiku-4-5` and returns JSON, degrading gracefully when no API key is set.

**Hard rule — Haiku translates, it does not optimize.** The v3 solver already computes the optimal order, ETAs, and the `warnings` / `unscheduledTasks`. Haiku's only job is turning that structured output into language + actionable advice. It must never be asked to compute the route.

## Scope

- **In:** Route Advisor panel under the optimized result — (a) a one-line route brief, (b) explanations of `warnings` + `unscheduledTasks`, (c) 0–3 concrete suggestions. (This folds in the earlier "unscheduled-visit explainer" idea #3.)
- **Out (fast-follow):** "Suggest a reorder" that proposes a manual order and lets the user Apply (idea #4). The manual-reorder plumbing already exists (`onMoveStop` / Recalculate), so this is a clean follow-on once the Advisor ships.
- **Out:** any AI involvement in the actual optimization.

## ⚠️ PHI / compliance — the central constraint

`the-block` is a car-auction app with no sensitive data; **Routefy is healthcare** — patient names + addresses are PHI, and the project already has PHI cleanup on its radar. We must **not** send identifiable data to the Anthropic API.

- Build the request from a **de-identified route context**: positions ("Stop 1/2/3"), window times, expected service start, visit duration, `lateBySeconds`, window type (fixed/flexible), per-leg drive time/distance, on-time flag, finish time, and **counts/reasons** for unscheduled — **never** names or addresses.
- The existing `warnings` / `unscheduledTasks` strings **may embed patient names** — the de-identify transform must replace any name/address with the positional token ("Stop N") before anything leaves the browser.
- De-identification is a **pure, unit-tested function**; the backend additionally validates the request shape (defense in depth). If anyone later wants real names in the output, that's a **BAA/DPA conversation first** — call it out, don't quietly enable it.

## Architecture (the-block pattern → Routefy)

```
shared/contracts/routeAdvisor.ts          # DeidentifiedRouteContext (request) + RouteAdvisorResponse + parsers
frontend/.../route-planner/domain/buildRouteAdvisorContext.ts   # pure: OptimizeRouteResponse → de-identified context (strips PHI)
frontend/.../route-planner/hooks/useRouteAdvisor.ts             # fetch + loading/error/empty + cache-by-result
frontend/.../route-planner/ui/RouteAdvisorPanel.tsx             # view-only card under the result
backend/src/lib/ai/claude.ts              # lazy Anthropic singleton, hasAnthropicKey(), MODEL = "claude-haiku-4-5"
backend/src/lib/ai/prompts.ts             # ROUTE_ADVISOR_SYSTEM + routeAdvisorUserMessage(context)
backend/src/app/api/route-planner/advisor/route.ts   # POST: CORS → requireAuth → rateLimit → validate → key guard → Haiku → audit → JSON
```

Reuses existing backend infra exactly like the current routes: `lib/auth/requireAuth`, `lib/rateLimit`, `lib/audit/logAuditEvent`, `lib/http` (CORS/HttpError/toErrorResponse).

## Data flow

1. After optimize, the frontend already holds `OptimizeRouteResponse` (`onTime`, `routeLegs`, `unscheduledTasks`, `warnings`, per-stop windows/lateness).
2. `buildRouteAdvisorContext(result)` → **de-identified** `DeidentifiedRouteContext` (PHI stripped). Pure + tested.
3. `useRouteAdvisor` POSTs it to `/api/route-planner/advisor` — **only when the result changes** (cache by a stable hash of the context so we don't re-call Haiku on every render / reorder-in-progress).
4. Backend: `requireAuth` → `isWithinRateLimit` → parse/validate body via the contract → `hasAnthropicKey()` guard (503 → frontend hides the panel) → `getAnthropic().messages.create({ model, max_tokens, system, messages })` → extract text blocks → `logAuditEvent({ action: "route.advisor" })` → JSON.
5. `RouteAdvisorPanel` renders brief + suggestions, with Default/Loading/Error/Empty states.

## Output shape (`RouteAdvisorResponse`)

```ts
{ brief: string;            // one or two sentences
  suggestions: string[] }   // 0–3 short, actionable items; empty when the route is clean
```

Start with text-out (simplest). If we want strict structure later, switch to a Haiku **tool call** (`emit_advice`) — same as the-block's `apply_filters` search.

## Backend route specifics

- `runtime = "nodejs"`, POST + OPTIONS (CORS preflight) like the existing dashboard route.
- Rate-limit per nurse (auth) — reuse `lib/rateLimit` `isWithinRateLimit(nurseId)`.
- `max_tokens` small (~250); low temperature; `ROUTE_ADVISOR_SYSTEM` instructs: translate only, be concise, never invent data, output the brief + ≤3 suggestions, no PHI echoing.
- Errors: 429 (rate), 400 (bad body), 503 (no key — expected/benign), 502 (Claude failure). Audit-log success + failure.

## Frontend specifics

- New `RouteAdvisorPanel` rendered inside the result (under `OptimizedRouteResult`, above or beside the map). All styles via `responsiveStyles.ts` tokens; honor the state system (Default/Hover/Focus/Disabled/Loading/Error/Empty).
- `.tsx` stays view-only; fetch/cache logic in `useRouteAdvisor`; de-identify logic in the `domain/` module (per the repo's view/logic-separation rule).
- **Graceful**: 503 (no key) or any error → panel simply doesn't render (no scary banner). Loading → skeleton line. Stale result (manual reorder in progress) → show "estimated" / re-fetch after Recalculate, mirroring the existing stale handling.

## Tests

- **Backend route test** (mirror `the-block`'s `route.test.ts`): mock the Anthropic client; assert 401 (no auth), 429 (rate), 400 (bad body), 503 (no key), 200 happy path returns `{ brief, suggestions }`, and the **prompt contains no names/addresses** (PHI guard).
- **`buildRouteAdvisorContext` unit test**: given a result whose `warnings`/tasks contain a patient name → output context has **no** name/address, names replaced by "Stop N".
- **`RouteAdvisorPanel` component test**: loading / error-hidden / renders brief + suggestions / empty (clean route) states.
- Pre-push: `npm run lint` + `npm run test` from `frontend/`, and backend tests (`cd backend && npm run test`).

## Env / ops

- `ANTHROPIC_API_KEY` in the **backend** env (Vercel) only — never shipped to the frontend.
- Add the dep: `cd backend && npm i @anthropic-ai/sdk`.
- Cost is small (Haiku, ~1 call per optimize, cached) but add the per-nurse rate limit + result-hash cache so reoptimizing repeatedly doesn't fan out calls.

## Verification

- Local: set `ANTHROPIC_API_KEY`, optimize a route with a tight/late window and an unscheduled visit → Advisor explains it + suggests a fix; clean route → brief only, no suggestions.
- Unset the key → panel absent, no errors.
- Confirm (via a logged/inspected request in dev) the outbound payload carries **no** names/addresses.

## Open questions

1. **De-identified aggregates confirmed** as the approach (vs. names → needs BAA first)? _(assumed: yes, de-identified.)_
2. Panel placement — under the timeline, or in the right column near the map?
3. Text-out first, or go straight to a tool-call for strict structure?

## Phasing

- **Phase 1** — Route Advisor (brief + warning/unscheduled explanations + suggestions), text-out, de-identified. This plan.
- **Fast-follow** — "Suggest a reorder" (idea #4): Haiku proposes an order; user Applies via existing manual-reorder, then Recalculate.
