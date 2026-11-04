ALTER TABLE "events" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
-- Old kinds -> new ones (none were stored when this was written).
UPDATE "events" SET "kind" = CASE "kind" WHEN 'food' THEN 'date' WHEN 'home' THEN 'other' ELSE "kind" END;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "kind" SET DEFAULT 'other'::text;--> statement-breakpoint
DROP TYPE "public"."event_kind";--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('appointment', 'work', 'travel', 'date', 'family', 'other', 'checkin');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "kind" SET DEFAULT 'other'::"public"."event_kind";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "kind" SET DATA TYPE "public"."event_kind" USING "kind"::"public"."event_kind";