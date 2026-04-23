CREATE TABLE IF NOT EXISTS "recurring_visit_template_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "day_of_week" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recurring_visit_template_days_day_of_week_chk"
    CHECK ("recurring_visit_template_days"."day_of_week" between 0 and 6)
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_visit_template_days_template_id_recurring_visit_templates_id_fk'
  ) THEN
    ALTER TABLE "recurring_visit_template_days"
      ADD CONSTRAINT "recurring_visit_template_days_template_id_recurring_visit_templates_id_fk"
      FOREIGN KEY ("template_id")
      REFERENCES "public"."recurring_visit_templates"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_visit_template_days_template_id_idx"
  ON "recurring_visit_template_days" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_visit_template_days_template_day_unique"
  ON "recurring_visit_template_days" USING btree ("template_id", "day_of_week");--> statement-breakpoint
INSERT INTO "recurring_visit_template_days" ("template_id", "day_of_week")
SELECT DISTINCT "template_id", "day_of_week"
FROM "recurring_visit_template_windows"
ON CONFLICT ("template_id", "day_of_week") DO NOTHING;
