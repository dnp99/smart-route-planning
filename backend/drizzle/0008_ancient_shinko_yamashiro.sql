CREATE TABLE "route_optimization_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nurse_id" uuid NOT NULL,
	"planning_date" date NOT NULL,
	"timezone" text NOT NULL,
	"endpoint_version" text NOT NULL,
	"optimizer_version" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"optimization_objective" text,
	"preserve_order" boolean DEFAULT false NOT NULL,
	"requested_visit_count" integer NOT NULL,
	"scheduled_visit_count" integer NOT NULL,
	"on_time_visit_count" integer NOT NULL,
	"unscheduled_visit_count" integer NOT NULL,
	"fixed_window_violations" integer NOT NULL,
	"total_late_seconds" integer NOT NULL,
	"total_wait_seconds" integer NOT NULL,
	"total_distance_meters" integer NOT NULL,
	"total_duration_seconds" integer NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_optimization_runs_endpoint_version_chk" CHECK ("route_optimization_runs"."endpoint_version" in ('v2', 'v3')),
	CONSTRAINT "route_optimization_runs_optimization_objective_chk" CHECK ("route_optimization_runs"."optimization_objective" is null or "route_optimization_runs"."optimization_objective" in ('time', 'distance')),
	CONSTRAINT "route_optimization_runs_requested_visit_count_chk" CHECK ("route_optimization_runs"."requested_visit_count" >= 0),
	CONSTRAINT "route_optimization_runs_scheduled_visit_count_chk" CHECK ("route_optimization_runs"."scheduled_visit_count" >= 0),
	CONSTRAINT "route_optimization_runs_on_time_visit_count_chk" CHECK ("route_optimization_runs"."on_time_visit_count" >= 0),
	CONSTRAINT "route_optimization_runs_unscheduled_visit_count_chk" CHECK ("route_optimization_runs"."unscheduled_visit_count" >= 0),
	CONSTRAINT "route_optimization_runs_fixed_window_violations_chk" CHECK ("route_optimization_runs"."fixed_window_violations" >= 0),
	CONSTRAINT "route_optimization_runs_total_late_seconds_chk" CHECK ("route_optimization_runs"."total_late_seconds" >= 0),
	CONSTRAINT "route_optimization_runs_total_wait_seconds_chk" CHECK ("route_optimization_runs"."total_wait_seconds" >= 0),
	CONSTRAINT "route_optimization_runs_total_distance_meters_chk" CHECK ("route_optimization_runs"."total_distance_meters" >= 0),
	CONSTRAINT "route_optimization_runs_total_duration_seconds_chk" CHECK ("route_optimization_runs"."total_duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "route_optimization_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"visit_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"patient_name" text NOT NULL,
	"address" text NOT NULL,
	"window_start" time NOT NULL,
	"window_end" time NOT NULL,
	"window_type" text NOT NULL,
	"arrival_time" timestamp with time zone,
	"service_start_time" timestamp with time zone,
	"service_end_time" timestamp with time zone,
	"wait_seconds" integer,
	"late_by_seconds" integer,
	"on_time" boolean,
	"is_unscheduled" boolean DEFAULT false NOT NULL,
	"unscheduled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_optimization_tasks_window_type_chk" CHECK ("route_optimization_tasks"."window_type" in ('fixed', 'flexible')),
	CONSTRAINT "route_optimization_tasks_window_order_chk" CHECK ("route_optimization_tasks"."window_end" > "route_optimization_tasks"."window_start"),
	CONSTRAINT "route_optimization_tasks_wait_seconds_chk" CHECK ("route_optimization_tasks"."wait_seconds" is null or "route_optimization_tasks"."wait_seconds" >= 0),
	CONSTRAINT "route_optimization_tasks_late_by_seconds_chk" CHECK ("route_optimization_tasks"."late_by_seconds" is null or "route_optimization_tasks"."late_by_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "route_optimization_runs" ADD CONSTRAINT "route_optimization_runs_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_optimization_tasks" ADD CONSTRAINT "route_optimization_tasks_run_id_route_optimization_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."route_optimization_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_optimization_tasks" ADD CONSTRAINT "route_optimization_tasks_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_optimization_runs_nurse_id_idx" ON "route_optimization_runs" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "route_optimization_runs_nurse_created_at_idx" ON "route_optimization_runs" USING btree ("nurse_id","created_at");--> statement-breakpoint
CREATE INDEX "route_optimization_runs_nurse_planning_date_idx" ON "route_optimization_runs" USING btree ("nurse_id","planning_date");--> statement-breakpoint
CREATE INDEX "route_optimization_tasks_run_id_idx" ON "route_optimization_tasks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "route_optimization_tasks_nurse_id_idx" ON "route_optimization_tasks" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "route_optimization_tasks_nurse_service_start_idx" ON "route_optimization_tasks" USING btree ("nurse_id","service_start_time");