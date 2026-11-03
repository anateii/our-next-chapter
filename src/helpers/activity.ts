// What GET /api/activity returns per entry (see toClient() in api/activity.ts).
export interface ApiActivity {
  id: string;
  actorUserId: string;
  kind:
    | "task_added"
    | "step_added"
    | "task_done"
    | "goal_added"
    | "goal_completed"
    | "goal_photo"
    | "event_added";
  title: string; // as it was named at the time
  taskId: string | null;
  goalId: string | null;
  whenAt: string | null; // ISO: a new task's day or an event's start
  at: string; // ISO: when it happened
}

// The partner's entries since I last opened the feed (all of them if I never have).
export const newCount = (
  activity: readonly ApiActivity[],
  myUserId: string | null | undefined,
  lastSeenAt: string | null,
) =>
  activity.filter(
    (a) => a.actorUserId !== myUserId && (!lastSeenAt || a.at > lastSeenAt),
  ).length;

// Start of the feed: local midnight 6 days ago, so "the last 7 days" means calendar days.
export const activitySince = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
};
