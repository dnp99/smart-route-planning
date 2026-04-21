WITH duplicate_windows AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY "patient_id", "start_time", "end_time"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS duplicate_rank
  FROM "patient_visit_windows"
)
DELETE FROM "patient_visit_windows" AS "pvw"
USING duplicate_windows
WHERE "pvw".ctid = duplicate_windows.ctid
  AND duplicate_windows.duplicate_rank > 1;--> statement-breakpoint
DROP INDEX "patient_visit_windows_patient_time_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "patient_visit_windows_patient_time_unique_idx" ON "patient_visit_windows" USING btree ("patient_id","start_time","end_time");
