# CareFlow — Entity Relationship Diagram

## Schema diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          nurses                             │
│─────────────────────────────────────────────────────────────│
│ id (PK, uuid)                                               │
│ external_key (unique)      ← identity provider key         │
│ display_name, email (unique)                                │
│ home_address, working_hours (jsonb)                         │
│ break_gap_threshold_minutes, optimization_objective         │
│ password_hash                                               │
│ is_active, last_login_at                                    │
│ legal_notice_accepted_at/version                            │
│ created_at, updated_at                                      │
└──────────┬──────────────────────────────────────────────────┘
           │ 1
           │
     ┌─────┴─────────────────────────────────────────────────────────────────────┐
     │                 │                    │                      │             │
     ▼ N               ▼ N                  ▼ N                    ▼ N           ▼ N (nullable)
┌──────────────┐ ┌──────────────────┐ ┌────────────────────┐ ┌─────────────┐ ┌─────────────┐
│   patients   │ │  route_optim...  │ │   auth_sessions    │ │audit_events │ │route_optim..│
│              │ │     _runs        │ │                    │ │             │ │   _tasks    │
│──────────────│ │──────────────────│ │────────────────────│ │─────────────│ │─────────────│
│ id (PK)      │ │ id (PK)          │ │ id (PK, text)      │ │ id (PK)     │ │ id (PK)     │
│ nurse_id(FK) │ │ nurse_id (FK)    │ │ nurse_id (FK)      │ │actor_nurse_ │ │ run_id (FK) │
│ first_name   │ │ planning_date    │ │ expires_at         │ │ id (FK,     │ │ nurse_id(FK)│
│ last_name    │ │ timezone         │ │ revoked_at         │ │ nullable)   │ │ visit_id    │
│ address      │ │ endpoint_version │ │ last_seen_at       │ │ action      │ │ patient_id  │
│ google_      │ │ optimizer_version│ │ ip_address         │ │ resource_   │ │ window_start│
│  place_id    │ │ algorithm_version│ │ user_agent         │ │  type/id    │ │ window_end  │
│ visit_dur... │ │ optimization_obj │ │ created_at         │ │ outcome     │ │ window_type │
│ pref_start/  │ │ preserve_order   │ └────────────────────┘ │ metadata    │ │ arrival_time│
│   end_time   │ │ requested/       │                        │  (jsonb)    │ │ service_    │
│ visit_time_  │ │  scheduled/      │                        │ ip_address  │ │  start/end  │
│   type       │ │  ontime/         │                        │ user_agent  │ │ wait_seconds│
│ is_active    │ │  unscheduled_    │                        │ created_at  │ │ late_by_sec │
│ last_sched.. │ │  visit_count     │                        └─────────────┘ │ on_time     │
│ created_at   │ │ fixed_window_    │                                         │ is_unscheduled│
│ updated_at   │ │  violations      │                                         │ unscheduled_│
└──────┬───────┘ │ total_late/wait/ │                                         │  reason     │
       │ 1       │  distance/       │                                         │ created_at  │
       │         │  duration_secs   │                                         └─────────────┘
       ▼ N       │ warnings (jsonb) │                                              ▲
┌──────────────────┐ request_id    │                                              │ N
│patient_visit_    │ created_at    │ ─────────────────────────────────────────────┘ 1
│   windows        └───────────────┘ (run_id FK → route_optimization_runs)
│──────────────────│
│ id (PK)          │
│ patient_id (FK)  │
│ start_time       │
│ end_time         │
│ visit_time_type  │
│ created_at       │
│ updated_at       │
└──────────────────┘
```

## Relationships

```
nurses  ──< patients ──< patient_visit_windows
nurses  ──< route_optimization_runs ──< route_optimization_tasks
nurses  ──< auth_sessions
nurses  ──< audit_events  (nullable — events outlive deleted nurses)
```

## Table reference

| Table | Purpose |
|---|---|
| **nurses** | The app's users. Stores credentials, profile, working hours config, and legal consent. One nurse = one account. |
| **patients** | Clients belonging to a nurse. Stores address, visit duration, and preferred time window. Soft-deleted via `is_active`. |
| **patient_visit_windows** | Additional time windows per patient (a patient can have multiple acceptable visit slots beyond the primary one on their profile). |
| **route_optimization_runs** | One record per route optimization request. Captures the full metrics snapshot — visit counts, distances, late seconds, warnings — so the dashboard can report history without re-running anything. |
| **route_optimization_tasks** | One row per stop within a run. Records the exact scheduled times, wait/late seconds, and whether the visit was on-time or unscheduled. |
| **auth_sessions** | Cookie-based session tokens. Tracks expiry, revocation, last-seen, and device info (IP/UA) for audit purposes. |
| **audit_events** | Append-only log of security-relevant actions (login, logout, profile change, etc.). `actor_nurse_id` is nullable so events survive nurse deletion. |

## Notes

- All primary keys are UUIDs generated by the database (`defaultRandom()`).
- `route_optimization_tasks` carries a direct `nurse_id` FK in addition to `run_id` so the dashboard can query a nurse's task history without joining through runs.
- `patients` and `nurses` use soft deletion (`is_active`) rather than hard deletes to preserve route history referential integrity.
- `audit_events.actor_nurse_id` uses `ON DELETE SET NULL` so audit records are never lost when a nurse account is removed.
- All other FK relationships use `ON DELETE CASCADE`.
