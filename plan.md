# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/plan.md` - implementation history and completed change log
- `plans/google-routes-phase-1-plan.md` - upcoming Phase 1 Google Routes migration plan

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

### Change
Updated `AGENT.md` with a mandatory branch workflow: always pull latest `main` first, then create a new working branch before making changes.

### Files added/updated/deleted
- Updated:
  - `AGENT.md`
  - `plan.md`
  - `plans/plan.md`

### Why
`main` is protected and should remain clean and in sync; enforcing an explicit pull-then-branch workflow prevents accidental commits on `main` and reduces branch divergence.

### Verification
- Confirmed `AGENT.md` includes the new mandatory branch workflow and recovery steps.
- Confirmed this change is recorded in both `plan.md` and `plans/plan.md`.

For full implementation details, see `plans/plan.md` section **32) Mandatory Pull-Main-Then-Branch Workflow**.
