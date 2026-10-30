CREATE TYPE "public"."event_kind" AS ENUM('home', 'food', 'checkin', 'other');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "event_kind" DEFAULT 'other' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_space_starts_idx" ON "events" USING btree ("space_id","starts_at");--> statement-breakpoint
CREATE INDEX "goals_space_idx" ON "goals" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_featured_idx" ON "goals" USING btree ("space_id") WHERE "goals"."featured";--> statement-breakpoint
CREATE INDEX "tasks_space_due_idx" ON "tasks" USING btree ("space_id","due_at");