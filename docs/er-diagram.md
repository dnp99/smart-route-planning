# Routefy — Entity Relationship Diagram

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
     ┌─────┴──────────────────────────────────────────────────────────────────────┐
     │                 │                    │                      │              │
     ▼ N               ▼ N                  ▼ N                    ▼ N            ▼ N (nullable)
┌──────────────┐ ┌──────────────────┐ ┌────────────────────┐ ┌─────────────┐ ┌──────────────┐
│   patients   │ │  route_optim...  │ │   auth_sessions    │ │audit_events │ │route_optim.. │
│              │ │     _runs        │ │                    │ │             │ │   _tasks     │
│──────────────│ │──────────────────│ │────────────────────│ │─────────────│ │──────────────│
│ id (PK)      │ │ id (PK)          │ │ id (PK, text)      │ │ id (PK)     │ │ id (PK)      │
│ nurse_id(FK) │ │ nurse_id (FK)    │ │ nurse_id (FK)      │ │actor_nurse_ │ │ run_id (FK)  │
│ first_name   │ │ planning_date    │ │ expires_at         │ │ id (FK,     │ │ nurse_id(FK) │
│ last_name    │ │ timezone         │ │ revoked_at         │ │ nullable)   │ │ visit_inst.. │
│ address      │ │ endpoint_version │ │ last_seen_at       │ │ action      │ │  _id (FK,    │
│ google_      │ │ optimizer_version│ │ ip_address         │ │ resource_   │ │  nullable)   │
│  place_id    │ │ algorithm_version│ │ user_agent         │ │  type/id    │ │ template_id  │
│ visit_dur... │ │ optimization_obj │ │ created_at         │ │ outcome     │ │  (FK,        │
│ pref_start/  │ │ preserve_order   │ └────────────────────┘ │ metadata    │ │  nullable)   │
│   end_time   │ │ requested/       │                        │  (jsonb)    │ │ patient_id   │
│ visit_time_  │ │  scheduled/      │                        │ ip_address  │ │ window_start │
│   type       │ │  ontime/         │                        │ user_agent  │ │ window_end   │
│ is_active    │ │  unscheduled_    │                        │ created_at  │ │ window_type  │
│ last_sched.. │ │  visit_count     │                        └─────────────┘ │ arrival_time │
│ created_at   │ │ fixed_window_    │                                         │ service_     │
│ updated_at   │ │  violations      │                                         │  start/end   │
└──────┬───────┘ │ total_late/wait/ │                                         │ wait_seconds │
       │ 1       │  distance/       │                                         │ late_by_sec  │
       │         │  duration_secs   │                                         │ on_time      │
       ▼ N       │ warnings (jsonb) │                                         │ is_unscheduled│
┌──────────────────┐ request_id    │                                         │ unscheduled_ │
│patient_visit_    │ created_at    │                                         │  reason      │
│   windows        └───────────────┘                                         │ created_at   │
│──────────────────│                                                          └──────┬───────┘
│ id (PK)          │                                                                 │ N
│ patient_id (FK)  │                                                      run_id FK ─┘
│ start_time       │                                                      (→ route_optimization_runs)
│ end_time         │
│ visit_time_type  │
│ created_at       │
│ updated_at       │
└──────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Recurring Visit Schedule                                         │
└────────────────────────────────────────────────────────────────────────────────────────────┘

patients ──< recurring_visit_templates ──< recurring_visit_template_days
                      │
                      └──< visit_instances

┌─────────────────────────────────┐   ┌────────────────────────────────┐
│   recurring_visit_templates     │   │ recurring_visit_template_days  │
│─────────────────────────────────│   │────────────────────────────────│
│ id (PK)                         │   │ id (PK)                        │
│ nurse_id (FK)                   │1 N│ template_id (FK, cascade)      │
│ patient_id (FK, cascade)        ├───┤ day_of_week (0=Sun … 6=Sat)    │
│ name                            │   │ created_at, updated_at         │
│ timezone                        │   │ unique (template_id, day_of_week)│
│ recurrence_rule (RRULE string)  │   └────────────────────────────────┘
│ start_date, end_date            │
│ is_active                       │   ┌────────────────────────────────┐
│ created_at, updated_at          │   │       visit_instances          │
└─────────────────────────────────┘   │────────────────────────────────│
                                      │ id (PK)                        │
                                      │ nurse_id (FK)                  │
                                      │ patient_id (FK)                │
                                      │ template_id (FK, nullable)     │
                                      │ occurrence_key (unique)        │
                                      │ planning_date                  │
                                      │ address, google_place_id       │
                                      │ window_start, window_end       │
                                      │ visit_time_type                │
                                      │ service_duration_minutes       │
                                      │ status (scheduled|cancelled)   │
                                      │ is_manual_override             │
                                      │ created_at, updated_at         │
                                      └────────────────────────────────┘
```

## Relationships

```
nurses  ──< patients ──< patient_visit_windows
nurses  ──< patients ──< recurring_visit_templates ──< recurring_visit_template_days
nurses  ──< patients ──< recurring_visit_templates ──< visit_instances
nurses  ──< route_optimization_runs ──< route_optimization_tasks
nurses  ──< auth_sessions
nurses  ──< audit_events  (nullable — events outlive deleted nurses)
route_optimization_tasks.visit_instance_id → visit_instances (nullable, SET NULL)
route_optimization_tasks.template_id → recurring_visit_templates (nullable, SET NULL)
```

## Table reference

| Table | Purpose |
|---|---|
| **nurses** | The app's users. Stores credentials, profile, working hours config, and legal consent. One nurse = one account. |
| **patients** | Clients belonging to a nurse. Stores address, visit duration, and preferred time window. Soft-deleted via `is_active`. |
| **patient_visit_windows** | Additional time windows per patient. A patient can have multiple acceptable visit slots. Unique on `(patient_id, start_time, end_time)`. |
| **recurring_visit_templates** | Recurrence schedule for a patient. Owns name, timezone, RRULE string, date range, and active flag. Visit timing and duration come from the patient record — the template only describes *when* (which days) visits recur. |
| **recurring_visit_template_days** | One row per weekday (0–6) for a template. Unique on `(template_id, day_of_week)`. Replaced the old `recurring_visit_template_windows` table which stored full window times per day. |
| **visit_instances** | Concrete scheduled visits materialized from a template + patient data for a specific planning date. Captures a snapshot of the patient's address/window/duration at expansion time. `is_manual_override` distinguishes manually edited instances from generated ones. |
| **route_optimization_runs** | One record per route optimization request. Captures the full metrics snapshot for dashboard history. |
| **route_optimization_tasks** | One row per stop within a run. Links to `visit_instances` and `recurring_visit_templates` (both nullable) so the dashboard can surface template names alongside stop history. |
| **auth_sessions** | Cookie-based session tokens. Tracks expiry, revocation, last-seen, and device info. |
| **audit_events** | Append-only log of security-relevant actions. `actor_nurse_id` is nullable so audit records survive nurse deletion. |

## Notes

- All primary keys are UUIDs generated by the database (`defaultRandom()`).
- `recurring_visit_template_days` has a unique constraint on `(template_id, day_of_week)` — one row per weekday per template.
- `visit_instances` uses a stable `occurrence_key` (`<templateId>:<patientVisitWindowId>:<planningDate>`) for idempotent expansion — repeated expansion never creates duplicates.
- `visit_instances.service_duration_minutes`, `window_start`, `window_end`, and `visit_time_type` are copied from the patient record at expansion time. They can be manually overridden per instance (`is_manual_override = true`).
- `route_optimization_tasks.visit_instance_id` uses `ON DELETE SET NULL` so optimization history is never lost when an instance is deleted.
- `patients` and `nurses` use soft deletion (`is_active`) rather than hard deletes to preserve route history referential integrity.
- `audit_events.actor_nurse_id` uses `ON DELETE SET NULL` so audit records are never lost when a nurse account is removed.
- All other FK relationships use `ON DELETE CASCADE`.
