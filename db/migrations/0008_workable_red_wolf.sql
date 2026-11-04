ALTER TYPE "public"."icon" ADD VALUE 'star';--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "when_text" text;--> statement-breakpoint
ALTER TABLE "wins" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "wins" ADD COLUMN "cheers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkins_space_created_idx" ON "checkins" USING btree ("space_id","created_at");