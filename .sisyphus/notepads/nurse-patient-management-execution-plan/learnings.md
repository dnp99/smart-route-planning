## Learnings

- Backend patient handlers can preserve strict route-layer boundaries cleanly by mocking `nurseContext`, repository, and DTO modules in route tests while still achieving 100% global coverage.
- With Next.js build type-checking enabled, relative imports from `backend/src/lib/patients/*` to `shared/contracts` must use `../../../../shared/contracts` (one extra `..` causes build-time module resolution failure).
