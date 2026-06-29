ALTER TABLE "patients" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "patients_nurse_archived_idx" ON "patients" USING btree ("nurse_id","archived_at");