# CareFlow — Claude Instructions

## Design System (mandatory)

**Always follow the design system.** Full specification: [`docs/design-system.md`](docs/design-system.md)

Key rules enforced every session:

1. **All styles live in `responsiveStyles.ts`** — never write repeated Tailwind color/spacing strings inline in components. One-off positional overrides (e.g. `pl-9` for a search icon inset) are the only acceptable exception.

2. **Inputs are always `bg-white`** — never `bg-slate-50` on an active input field.

3. **Cards are always `bg-white`** — never gray (`bg-slate-100`, `bg-slate-50`) as a card background. The page canvas (`bg-slate-50`) provides contrast; cards provide the white surface.

4. **Border defaults:** `border-slate-200` at rest, `border-slate-300` on hover. Never use `border-slate-300` as the default state.

5. **Buttons:**
   - Primary: `bg-blue-600 text-white hover:bg-blue-700`
   - Secondary: `bg-slate-100 text-slate-700 hover:bg-slate-200` — no border

6. **Status pills:** Fixed = `bg-blue-100 text-blue-700`, Flexible = `bg-emerald-100 text-emerald-700`

7. **Max content width:** `max-w-6xl` — do not change to `max-w-4xl` or narrower.

8. **Spacing:** 8pt grid only — `4 / 8 / 12 / 16 / 24 / 32px`.

9. **Shadows:** One level per element — `shadow-sm` for cards, `shadow-md` for chrome (header/footer). Never stack.

10. **Typography:** Map all text to the type scale in the design doc. Never introduce a new font size.

11. **State system (§9):** Every component handles Default / Hover / Focus / Disabled / Selected / Error / Loading / Empty — never omit a state.

12. **Table states (§10):** Empty = centered `text-slate-500`. Loading = skeleton rows (no spinners in table body). Error = red inline message inside the container. No layout shift between states.

13. **Selected/Active (§11):** `border-blue-200 bg-blue-50/50`. Blue = selection only. Green = success only. Amber = warning only. Red = error only. Never mix.

14. **Page background (§12):** `bg-gradient-to-b from-slate-50 to-white` on the outermost container only. The `max-w-6xl` content wrapper is always transparent.

15. **Mobile (§13):** Cards `p-4`, sections `gap-4`. Tables go card layout below `md`. All buttons `w-full sm:w-auto`. Touch targets minimum `44px`.

16. **Interaction priority (§14):** One primary action per section. Destructive = red text, not red button. Disabled = `opacity-60`, never hidden.

17. **Naming (§15):** Card = static. Panel = interactive/collapsible. Section = page-level grouping. Pill = inline badge. Use these terms consistently in code and component names.

## Stack

- Frontend: React + TypeScript, Vite, Tailwind CSS
- Shared contracts: `shared/contracts`
- Style tokens: `frontend/src/components/responsiveStyles.ts`
