CREATE TABLE "patient_visit_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"visit_time_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_visit_windows_visit_time_type_chk" CHECK ("patient_visit_windows"."visit_time_type" in ('fixed', 'flexible')),
	CONSTRAINT "patient_visit_windows_window_order_chk" CHECK ("patient_visit_windows"."end_time" > "patient_visit_windows"."start_time")
);
--> statement-breakpoint
ALTER TABLE "patient_visit_windows" ADD CONSTRAINT "patient_visit_windows_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_visit_windows_patient_id_idx" ON "patient_visit_windows" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_visit_windows_patient_time_idx" ON "patient_visit_windows" USING btree ("patient_id","start_time","end_time");
--> statement-breakpoint
INSERT INTO "patient_visit_windows" (
	"patient_id",
	"start_time",
	"end_time",
	"visit_time_type",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"preferred_visit_start_time",
	"preferred_visit_end_time",
	"visit_time_type",
	"created_at",
	"updated_at"
FROM "patients";
