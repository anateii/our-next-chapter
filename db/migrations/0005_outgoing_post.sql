ALTER TABLE "events" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "created_by" text;