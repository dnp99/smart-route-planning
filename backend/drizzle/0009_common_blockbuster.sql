ALTER TABLE "patients" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "last_scheduled_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "patients_nurse_active_idx" ON "patients" USING btree ("nurse_id","is_active");