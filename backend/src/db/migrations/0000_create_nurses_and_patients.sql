CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "nurses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_key" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "patients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nurse_id" uuid NOT NULL REFERENCES "nurses" ("id") ON DELETE CASCADE,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "address" text NOT NULL,
  "google_place_id" text,
  "preferred_visit_start_time" time NOT NULL,
  "preferred_visit_end_time" time NOT NULL,
  "visit_time_type" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "patients_visit_time_type_chk" CHECK ("visit_time_type" IN ('fixed', 'flexible')),
  CONSTRAINT "patients_visit_window_order_chk" CHECK (
    "preferred_visit_end_time" > "preferred_visit_start_time"
  )
);

CREATE INDEX IF NOT EXISTS "patients_nurse_id_idx" ON "patients" ("nurse_id");
CREATE INDEX IF NOT EXISTS "patients_nurse_name_idx" ON "patients" ("nurse_id", "last_name", "first_name");

INSERT INTO "nurses" ("external_key", "display_name")
VALUES ('default-nurse', 'Default Nurse')
ON CONFLICT ("external_key") DO NOTHING;
