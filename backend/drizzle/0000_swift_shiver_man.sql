CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "nurses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_key" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nurses_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nurse_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"address" text NOT NULL,
	"google_place_id" text,
	"preferred_visit_start_time" time NOT NULL,
	"preferred_visit_end_time" time NOT NULL,
	"visit_time_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_visit_time_type_chk" CHECK ("patients"."visit_time_type" in ('fixed', 'flexible')),
	CONSTRAINT "patients_visit_window_order_chk" CHECK ("patients"."preferred_visit_end_time" > "patients"."preferred_visit_start_time")
);
--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patients_nurse_id_idx" ON "patients" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "patients_nurse_name_idx" ON "patients" USING btree ("nurse_id","last_name","first_name");
--> statement-breakpoint
INSERT INTO "nurses" ("external_key", "display_name")
VALUES ('default-nurse', 'Nicole Su')
ON CONFLICT ("external_key") DO UPDATE
SET "display_name" = EXCLUDED."display_name";
