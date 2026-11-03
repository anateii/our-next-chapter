CREATE TYPE "public"."goal_category" AS ENUM('travel', 'home', 'career', 'finance', 'life');--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "category" "goal_category" DEFAULT 'life' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "steps_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "steps_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "next_step" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "goals" SET "category" = 'finance' WHERE "target_cents" IS NOT NULL;