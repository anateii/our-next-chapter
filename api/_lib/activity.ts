import { and, eq, gte, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { activity } from "../../db/schema.js";

export type ActivityKind =
  | "task_added"
  | "step_added"
  | "task_done"
  | "goal_added"
  | "goal_completed"
  | "goal_photo"
  | "event_added"
  | "expense_added"
  | "savings_added"
  | "settled";

// Record something one of you did. Best effort: a missing feed entry must
// never fail the change itself.
export async function logActivity(entry: {
  spaceId: string;
  actorUserId: string;
  kind: ActivityKind;
  title: string;
  taskId?: string | null;
  goalId?: string | null;
  whenAt?: Date | null;
}) {
  try {
    await db.insert(activity).values(entry);
  } catch (err) {
    console.error("Logging activity failed:", err);
  }
}

// Ticking a task off and straight back on is a correction, not news: drop
// its "finished" entry, and its goal's "completed" one, if they're from the
// last 10 minutes.
export async function unlogTaskDone(spaceId: string, taskId: string, goalId: string | null) {
  const recent = and(
    eq(activity.spaceId, spaceId),
    gte(activity.createdAt, new Date(Date.now() - 10 * 60 * 1000)),
  );
  const finished = and(eq(activity.taskId, taskId), eq(activity.kind, "task_done"));
  const completed = goalId
    ? and(eq(activity.goalId, goalId), eq(activity.kind, "goal_completed"))
    : undefined;
  try {
    await db.delete(activity).where(and(recent, completed ? or(finished, completed) : finished));
  } catch (err) {
    console.error("Removing activity failed:", err);
  }
}
