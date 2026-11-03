ALTER TABLE "tasks" ADD COLUMN "goal_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "tasks" SET "done_at" = "created_at" WHERE "done";