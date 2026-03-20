# Global Header + Footer + Legal Pages Plan

## Status

- Planned
- Last updated: 2026-03-19

## Summary

Add a consistent app shell update so authenticated pages include:

- richer global header treatment (brand + existing nav/account menu retained),
- global footer with `Contact Us`, `Terms`, `Privacy`, `License`, `Trademark`,
- in-app legal pages for each legal link.

## Locked Decisions

- Legal presentation: footer links + in-app pages
- Contact method: single support email
- Legal owner: `CareFlow`
- Support email: `dpatel1995@yahoo.com`

## Implementation Plan

### 1) App Shell Layout Update (`frontend/src/App.jsx`)

- Keep existing account menu, navigation, and protected-route behavior unchanged.
- Ensure top-level shell consistently renders header/content/footer.
- Add global footer for authenticated routes (`/patients`, `/route-planner`), and keep visible on login unless layout conflicts appear.
- Footer content:
  - `Contact Us` mailto: `mailto:dpatel1995@yahoo.com`
  - Legal links to:
    - `/legal/terms`
    - `/legal/privacy`
    - `/legal/license`
    - `/legal/trademark`
  - `© {currentYear} CareFlow. All rights reserved.`
  - `CareFlow is a trademark of CareFlow.`

### 2) Add Legal Pages + Routes

- Add static page components for:
  - Terms (`/legal/terms`)
  - Privacy (`/legal/privacy`)
  - License (`/legal/license`)
  - Trademark (`/legal/trademark`)
- Register routes in `App.jsx` using existing router setup.
- Keep legal pages public (no auth guard) to avoid footer-link redirect loops.

### 3) Styling + Accessibility

- Use existing Tailwind visual language (slate/blue, rounded cards).
- Footer responsive behavior:
  - stacked sections on mobile,
  - multi-column layout on desktop.
- Ensure clear hover/focus states and keyboard navigation on all footer links.

### 4) Legal Copy Defaults

- Terms: intended use, account responsibilities, availability disclaimer.
- Privacy: data used for auth/planning, retention placeholder, support contact email.
- License: application license statement + third-party notices placeholder.
- Trademark: mark usage statement + rights reservation.
- Include `Last updated` placeholder on each legal page.

## Public Interfaces

- New frontend routes:
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/license`
  - `/legal/trademark`
- No backend or shared-contract changes.

## Test Plan

- Update `frontend/src/tests/appRoutes.test.tsx`:
  - assert footer renders with `Contact Us` and all 4 legal links,
  - assert legal routes render expected headings.
- Add/extend navigation assertions:
  - footer links navigate to the correct legal page.
- Verify existing auth/menu/nav tests still pass.
- Accessibility checks:
  - focusable footer links,
  - one primary heading per legal page.

## Assumptions

- Legal content is placeholder operational copy, not legal counsel-approved text.
- Owner/mark text uses `CareFlow` exactly.
- Support email remains `dpatel1995@yahoo.com` until changed.
