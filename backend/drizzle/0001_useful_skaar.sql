ALTER TABLE "nurses" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
UPDATE "nurses"
SET "email" = LOWER(TRIM("email"));--> statement-breakpoint
ALTER TABLE "nurses" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nurses" ALTER COLUMN "password_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nurses" ADD CONSTRAINT "nurses_email_unique" UNIQUE("email");
