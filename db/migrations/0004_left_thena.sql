CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"task_id" uuid,
	"goal_id" uuid,
	"when_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "last_seen_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_space_created_idx" ON "activity" USING btree ("space_id","created_at");--> statement-breakpoint
-- Backfill: tasks added in the last week (they record who added them), so
-- Recent activity isn't empty on day one.
INSERT INTO "activity" ("space_id", "actor_user_id", "kind", "title", "task_id", "goal_id", "when_at", "created_at")
SELECT "space_id", "created_by", CASE WHEN "goal_id" IS NULL THEN 'task_added' ELSE 'step_added' END,
       "title", "id", "goal_id", "due_at", "created_at"
FROM "tasks"
WHERE "created_by" IS NOT NULL AND "created_at" >= now() - interval '7 days';
