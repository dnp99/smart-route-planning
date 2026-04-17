CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_nurse_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"outcome" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"nurse_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route_optimization_tasks" ALTER COLUMN "patient_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "route_optimization_tasks" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
UPDATE "route_optimization_tasks"
SET "patient_name" = NULL,
    "address" = NULL
WHERE "patient_name" IS NOT NULL
   OR "address" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_nurse_id_nurses_id_fk" FOREIGN KEY ("actor_nurse_id") REFERENCES "public"."nurses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events" USING btree ("actor_nurse_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_created_idx" ON "audit_events" USING btree ("resource_type","created_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_nurse_id_idx" ON "auth_sessions" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_nurse_expires_idx" ON "auth_sessions" USING btree ("nurse_id","expires_at");
