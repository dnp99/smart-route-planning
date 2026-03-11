# AGENT.md

## Change Documentation Rule (Mandatory)

For this repository, **every code change must be recorded in `plan.md`**.

### Required process after each code update
1. Update `plan.md` immediately in the same work session.
2. Include:
   - files added/updated/deleted,
   - what changed,
   - why the change was made,
   - verification performed (lint/build/tests) and results.
3. Keep `plan.md` as the single source of truth for implementation history.

### Scope
- Applies to frontend, backend, config, docs, and infrastructure changes.
- Applies to all future updates in this project.

## Branch Workflow Rule (Mandatory)

For this repository, **never start work from a stale branch and never commit directly on `main`**.

### Required branch process before implementing changes
1. Switch to `main`:
   - `git switch main`
2. Pull latest `main`:
   - `git pull --ff-only origin main`
3. Create a new working branch from updated `main`:
   - `git switch -c <descriptive-branch-name>`
4. Do all changes and commits on that new branch.

### Recovery if a commit is made on `main`
1. Create a new branch from the current commit on `main`.
2. Reset local `main` back to `origin/main`.
3. Continue work from the new branch.
