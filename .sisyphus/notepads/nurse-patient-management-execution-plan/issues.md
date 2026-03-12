## Issues / Blockers

- Initial Vitest mocks for new patient tests failed due hoisted `vi.mock` factories referencing non-hoisted local constants. Resolved by switching to `vi.hoisted(() => ({ ...vi.fn() }))` for all mocked function handles.
- Coverage initially dropped below required 100% thresholds after adding patient modules/routes. Resolved by adding targeted branch tests (query-omitted GET path and extra update-validation branches).
