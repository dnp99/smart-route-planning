ALTER TABLE "recurring_visit_template_windows" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "recurring_visit_template_windows" CASCADE;--> statement-breakpoint
ALTER TABLE "recurring_visit_templates" DROP CONSTRAINT "recurring_visit_templates_duration_chk";--> statement-breakpoint
ALTER TABLE "recurring_visit_templates" DROP COLUMN "service_duration_minutes";
