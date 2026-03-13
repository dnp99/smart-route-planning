# JWT Authentication Remediation Release Note

Date: 2026-03-13

- Completed the JWT auth remediation rollout for legacy environments without breaking existing nurse or patient ownership.
- Added a one-time bootstrap path for the original nurse account, hardened duplicate-email signup handling to return `409 Conflict`, and finalized non-null auth constraints after verified backfill.
- Production rollout is complete and verified, and the deployment docs now capture the full migration, bootstrap, and finalization sequence.
