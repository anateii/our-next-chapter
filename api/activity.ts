import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import { activity, members } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { dateParam, getMembership } from "./_lib/space.js";

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me };
}

const toClient = (a: typeof activity.$inferSelect) => ({
  id: a.id,
  actorUserId: a.actorUserId,
  kind: a.kind,
  title: a.title,
  taskId: a.taskId,
  goalId: a.goalId,
  whenAt: a.whenAt,
  at: a.createdAt,
});

// What happened in the space since `since` (ISO, default 7 days ago), newest
// first, plus when I last opened the feed:
//   GET /api/activity?since=2026-10-27T00:00:00+01:00
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const since = dateParam(
    new URL(req.url),
    "since",
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );
  const rows = await db
    .select()
    .from(activity)
    .where(and(eq(activity.spaceId, me.spaceId), gte(activity.createdAt, since)))
    .orderBy(desc(activity.createdAt))
    .limit(200);
  return json({ activity: rows.map(toClient), lastSeenAt: me.lastSeenActivityAt });
}

// I've opened the feed: everything up to now is seen. POST /api/activity
export async function POST(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const [row] = await db
    .update(members)
    .set({ lastSeenActivityAt: new Date() })
    .where(and(eq(members.spaceId, me.spaceId), eq(members.clerkUserId, me.clerkUserId)))
    .returning({ lastSeenAt: members.lastSeenActivityAt });
  return json({ lastSeenAt: row.lastSeenAt });
}
