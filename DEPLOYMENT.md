# Navigate Easy Deployment Strategy

## 1) Target architecture

- **Frontend** (`frontend/`): Vite static site on Vercel project `navigate-easy-frontend`
- **Backend** (`backend/`): Next.js API on Vercel project `navigate-easy-backend`
- **Domains**
  - Frontend: `app.yourdomain.com`
  - Backend: `api.yourdomain.com`

This keeps UI hosting and API scaling separate while preserving a simple DX.

---

## 2) Environments

Use two environments:

- **Staging**
  - Frontend URL: `https://app-staging.yourdomain.com`
  - Backend URL: `https://api-staging.yourdomain.com`
- **Production**
  - Frontend URL: `https://app.yourdomain.com`
  - Backend URL: `https://api.yourdomain.com`

---

## 3) Required environment variables

### Backend (Vercel Project: backend)

- `ALLOWED_ORIGINS`
  - Staging: `https://app-staging.yourdomain.com`
  - Production: `https://app.yourdomain.com`
- `JWT_SECRET`
  - Required long random secret used to sign and verify access tokens.
- `JWT_EXPIRES_IN`
  - Optional JWT TTL (for example `1h`, `30m`).
  - Default: `1h`.
- `GOOGLE_MAPS_API_KEY`
  - Required for route legs and address autocomplete.

### Frontend SPA routing

- Keep `frontend/vercel.json` deployed with the frontend project so Vercel rewrites deep links to `index.html`.
- This prevents direct loads or refreshes on routes such as `/patients` and `/route-planner` from returning `404`.

### Frontend runtime API URL

Frontend resolves API base URL from:

```js
window.__NAVIGATE_EASY_API_BASE_URL__
```

Add this script in `frontend/index.html` (or inject it at hosting edge):

```html
<script>
  window.__NAVIGATE_EASY_API_BASE_URL__ = "https://api.yourdomain.com";
</script>
```

For staging, set it to `https://api-staging.yourdomain.com`.

---

## 4) GitHub Secrets needed

Set these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_FRONTEND_PROJECT_ID`
- `VERCEL_BACKEND_PROJECT_ID`

Optional vars if you automate runtime frontend URL injection in pipeline:

- `FRONTEND_API_BASE_URL_STAGING`
- `FRONTEND_API_BASE_URL_PRODUCTION`

---

## 5) CI/CD flow

### CI workflow (`.github/workflows/ci.yml`)

Runs on PR and push:

1. Frontend: `npm ci`, `npm run lint`, `npm run build`
2. Backend: `npm ci`, `npm run lint`, `npm run build`

### Deploy workflow (`.github/workflows/deploy.yml`)

- On `develop` push: deploy **staging** frontend + backend to Vercel
- On `main` push: deploy **production** frontend + backend to Vercel

Deploy workflow should be gated by CI success using branch protection rules:

- Require `CI / Frontend lint + build`
- Require `CI / Backend lint + build`

---

## 6) Production safety checklist

Before first prod cut:

1. Verify backend CORS allows only frontend domain.
2. Confirm API health:
   - `POST /api/auth/login`
   - `GET /api/auth/me` with `Authorization: Bearer <token>`
   - `GET /api/address-autocomplete?query=Toronto` with bearer token
   - `POST /api/optimize-route/v2` with bearer token
3. Validate frontend runtime API URL points to prod backend.
4. Smoke test route optimization in browser.

---

## 7) Rollback strategy

- Use Vercel dashboard "Promote previous deployment" for frontend/backend separately.
- If backend rollback only is needed, keep frontend as-is (contract is stable JSON API).
- Keep one known-good staging deployment before promoting to production.

---

## 8) Post-deploy monitoring

Track at minimum:

- Backend error rate (5xx)
- Backend rate-limit responses (429/503)
- Autocomplete latency
- Route optimization latency

Set alerts on sustained 5xx or sudden 429 spikes.
