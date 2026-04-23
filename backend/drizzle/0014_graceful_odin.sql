CREATE TABLE "recurring_visit_template_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"visit_time_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_visit_template_windows_day_of_week_chk" CHECK ("recurring_visit_template_windows"."day_of_week" between 0 and 6),
	CONSTRAINT "recurring_visit_template_windows_visit_time_type_chk" CHECK ("recurring_visit_template_windows"."visit_time_type" in ('fixed', 'flexible')),
	CONSTRAINT "recurring_visit_template_windows_window_order_chk" CHECK ("recurring_visit_template_windows"."end_time" > "recurring_visit_template_windows"."start_time")
);
--> statement-breakpoint
CREATE TABLE "recurring_visit_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nurse_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text,
	"timezone" text NOT NULL,
	"recurrence_rule" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"service_duration_minutes" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_visit_templates_duration_chk" CHECK ("recurring_visit_templates"."service_duration_minutes" between 1 and 180),
	CONSTRAINT "recurring_visit_templates_date_range_chk" CHECK ("recurring_visit_templates"."end_date" is null or "recurring_visit_templates"."end_date" >= "recurring_visit_templates"."start_date")
);
--> statement-breakpoint
CREATE TABLE "visit_instance_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nurse_id" uuid NOT NULL,
	"visit_instance_id" uuid NOT NULL,
	"template_id" uuid,
	"exception_date" date NOT NULL,
	"action" text NOT NULL,
	"rescheduled_date" date,
	"override_start_time" time,
	"override_end_time" time,
	"override_visit_time_type" text,
	"override_service_duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_instance_exceptions_action_chk" CHECK ("visit_instance_exceptions"."action" in ('skip', 'reschedule', 'edit')),
	CONSTRAINT "visit_instance_exceptions_override_visit_time_type_chk" CHECK ("visit_instance_exceptions"."override_visit_time_type" is null or "visit_instance_exceptions"."override_visit_time_type" in ('fixed', 'flexible')),
	CONSTRAINT "visit_instance_exceptions_override_window_order_chk" CHECK ("visit_instance_exceptions"."override_end_time" is null or "visit_instance_exceptions"."override_start_time" is null or "visit_instance_exceptions"."override_end_time" > "visit_instance_exceptions"."override_start_time"),
	CONSTRAINT "visit_instance_exceptions_override_duration_chk" CHECK ("visit_instance_exceptions"."override_service_duration_minutes" is null or "visit_instance_exceptions"."override_service_duration_minutes" between 1 and 180)
);
--> statement-breakpoint
CREATE TABLE "visit_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nurse_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" uuid,
	"occurrence_key" text NOT NULL,
	"planning_date" date NOT NULL,
	"address" text NOT NULL,
	"google_place_id" text,
	"window_start" time NOT NULL,
	"window_end" time NOT NULL,
	"visit_time_type" text NOT NULL,
	"service_duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_instances_occurrence_key_unique" UNIQUE("occurrence_key"),
	CONSTRAINT "visit_instances_visit_time_type_chk" CHECK ("visit_instances"."visit_time_type" in ('fixed', 'flexible')),
	CONSTRAINT "visit_instances_window_order_chk" CHECK ("visit_instances"."window_end" > "visit_instances"."window_start"),
	CONSTRAINT "visit_instances_duration_chk" CHECK ("visit_instances"."service_duration_minutes" between 1 and 180),
	CONSTRAINT "visit_instances_status_chk" CHECK ("visit_instances"."status" in ('scheduled', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "recurring_visit_template_windows" ADD CONSTRAINT "recurring_visit_template_windows_template_id_recurring_visit_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_visit_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_templates" ADD CONSTRAINT "recurring_visit_templates_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_templates" ADD CONSTRAINT "recurring_visit_templates_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_instance_exceptions" ADD CONSTRAINT "visit_instance_exceptions_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_instance_exceptions" ADD CONSTRAINT "visit_instance_exceptions_visit_instance_id_visit_instances_id_fk" FOREIGN KEY ("visit_instance_id") REFERENCES "public"."visit_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_instance_exceptions" ADD CONSTRAINT "visit_instance_exceptions_template_id_recurring_visit_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_visit_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_instances" ADD CONSTRAINT "visit_instances_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_instances" ADD CONSTRAINT "visit_instances_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_instances" ADD CONSTRAINT "visit_instances_template_id_recurring_visit_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_visit_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_visit_template_windows_template_id_idx" ON "recurring_visit_template_windows" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "recurring_visit_template_windows_template_day_idx" ON "recurring_visit_template_windows" USING btree ("template_id","day_of_week");--> statement-breakpoint
CREATE INDEX "recurring_visit_templates_nurse_id_idx" ON "recurring_visit_templates" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "recurring_visit_templates_patient_id_idx" ON "recurring_visit_templates" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "recurring_visit_templates_nurse_active_idx" ON "recurring_visit_templates" USING btree ("nurse_id","is_active");--> statement-breakpoint
CREATE INDEX "visit_instance_exceptions_nurse_date_idx" ON "visit_instance_exceptions" USING btree ("nurse_id","exception_date");--> statement-breakpoint
CREATE INDEX "visit_instance_exceptions_instance_id_idx" ON "visit_instance_exceptions" USING btree ("visit_instance_id");--> statement-breakpoint
CREATE INDEX "visit_instance_exceptions_template_date_idx" ON "visit_instance_exceptions" USING btree ("template_id","exception_date");--> statement-breakpoint
CREATE INDEX "visit_instances_nurse_planning_date_idx" ON "visit_instances" USING btree ("nurse_id","planning_date");--> statement-breakpoint
CREATE INDEX "visit_instances_patient_planning_date_idx" ON "visit_instances" USING btree ("patient_id","planning_date");--> statement-breakpoint
CREATE INDEX "visit_instances_template_planning_date_idx" ON "visit_instances" USING btree ("template_id","planning_date");