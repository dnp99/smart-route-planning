ALTER TABLE "route_optimization_tasks"
ADD COLUMN IF NOT EXISTS "visit_instance_id" uuid;--> statement-breakpoint
ALTER TABLE "route_optimization_tasks"
ADD COLUMN IF NOT EXISTS "template_id" uuid;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_optimization_tasks_visit_instance_id_visit_instances_id_fk'
  ) THEN
    ALTER TABLE "route_optimization_tasks"
      ADD CONSTRAINT "route_optimization_tasks_visit_instance_id_visit_instances_id_fk"
      FOREIGN KEY ("visit_instance_id")
      REFERENCES "public"."visit_instances"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_optimization_tasks_template_id_recurring_visit_templates_id_fk'
  ) THEN
    ALTER TABLE "route_optimization_tasks"
      ADD CONSTRAINT "route_optimization_tasks_template_id_recurring_visit_templates_id_fk"
      FOREIGN KEY ("template_id")
      REFERENCES "public"."recurring_visit_templates"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "route_optimization_tasks_visit_instance_id_idx"
  ON "route_optimization_tasks" USING btree ("visit_instance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "route_optimization_tasks_template_id_idx"
  ON "route_optimization_tasks" USING btree ("template_id");
