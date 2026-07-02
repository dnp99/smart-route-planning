# Routefy — Claude Instructions

## Design System (mandatory)

**Always follow the design system.** Full specification: [`docs/design-system.md`](docs/design-system.md)

Key rules enforced every session:

1. **All styles live in `responsiveStyles.ts`** — never write repeated Tailwind color/spacing strings inline in components. One-off positional overrides (e.g. `pl-9` for a search icon inset) are the only acceptable exception.

2. **Inputs are always `bg-white`** — never `bg-slate-50` on an active input field.

3. **Card surface hierarchy (design 2a):** the page canvas is **white**, so contrast comes from a two-tier card system:
   - **Primary / hero / data cards** stay **`bg-white`** with a `border-slate-200` outline (the outline, not a gray fill, separates them from the white canvas).
   - **Secondary "tile" surfaces** (sidebar Today/account tiles, stat/KPI tiles, supporting summary tiles) use **`surfaceSecondary`** (`#F4F4F6` + `#E2E8F0` border). Never make a primary card or a data table gray.

4. **Border defaults:** `border-slate-200` at rest, `border-slate-300` on hover. Never use `border-slate-300` as the default state.

5. **Buttons:**
   - Primary: `bg-blue-600 text-white hover:bg-blue-700`
   - Secondary: `bg-slate-100 text-slate-700 hover:bg-slate-200` — no border

6. **Status pills:** Fixed = `bg-blue-100 text-blue-700`, Flexible = `bg-emerald-100 text-emerald-700`

7. **Max content width:** `max-w-7xl` — do not change to `max-w-4xl` or narrower.

8. **Spacing:** 8pt grid only — `4 / 8 / 12 / 16 / 24 / 32px`.

9. **Shadows:** One level per element — `shadow-sm` for cards. Header and footer are borderless and frosted over the white canvas (`bg-white/80 backdrop-blur-md`, no shadow). Never stack shadows.

10. **Typography:** Map all text to the type scale in the design doc. Never introduce a new font size.

11. **State system (§9):** Every component handles Default / Hover / Focus / Disabled / Selected / Error / Loading / Empty — never omit a state.

12. **Table states (§10):** Empty = centered `text-slate-500`. Loading = skeleton rows (no spinners in table body). Error = red inline message inside the container. No layout shift between states.

13. **Selected/Active (§11):** `border-blue-200 bg-blue-50/50`. Blue = selection only. Green = success only. Amber = warning only. Red = error only. Never mix.

14. **Page background (§12):** flat **white** (`bg-white`) on the outer shell/canvas only (the `appCanvas`/`appShell` tokens). The sidebar and the `max-w-7xl` content wrapper are transparent over it. Contrast comes from card outlines + the `surfaceSecondary` (`#F4F4F6`) tiles, not from a tinted canvas.

15. **Mobile (§13):** Cards `p-4`, sections `gap-4`. Tables go card layout below `md`. All buttons `w-full sm:w-auto`. Touch targets minimum `44px`.

16. **Interaction priority (§14):** One primary action per section. Destructive = red text, not red button. Disabled = `opacity-60`, never hidden.

17. **Naming (§15):** Card = static. Panel = interactive/collapsible. Section = page-level grouping. Pill = inline badge. Use these terms consistently in code and component names.

## Pre-push checklist (mandatory)

Before every `git push`, run both of these from `frontend/` and fix any failures:

```sh
npm run lint   # ESLint + ES compatibility check
npm run test   # Vitest unit tests (or: node_modules/.bin/vitest run)
```

Never push with failing lint or tests.

## Database migrations (mandatory)

Never create Drizzle migration files manually. Drizzle validates a chain of snapshot metadata and content hashes — hand-crafted files are silently skipped by `drizzle-kit migrate`, breaking the DB without any error.

Correct workflow for every schema change:

1. Update `backend/src/db/schema.ts`
2. `cd backend && npm run db:generate` — connects to the real DB, diffs the schema, and writes the SQL file + a properly-chained snapshot with correct hashes
3. `npm run db:migrate` — applies the pending migration

`npm run db:generate` requires a live `DATABASE_URL`. If the environment doesn't have one, ask the user to run step 2 themselves.

**Never run `drizzle-kit push`** against prod or preview. `push` syncs the schema directly without recording anything in `drizzle.__drizzle_migrations`, so the journal falls behind the schema — then `migrate` tries to re-apply already-present changes and fails with `column … already exists`. Always use generate + migrate.

Migrations apply automatically: on `npm run dev` (a `predev` hook) and on every Vercel **production/preview** build (`vercel.json` `buildCommand` → `scripts/migrate-on-deploy.mjs`). No manual `db:migrate` in normal flow.

If a deploy/migrate fails with `column … already exists` (journal drift), see [`docs/database-migrations.md`](docs/database-migrations.md) for the reconciliation runbook.

## Stack

- Frontend: React + TypeScript, Vite, Tailwind CSS
- Backend: Next.js API routes, Drizzle ORM, PostgreSQL (Neon)
- Shared contracts: `shared/contracts`
- Style tokens: `frontend/src/components/responsiveStyles.ts`
