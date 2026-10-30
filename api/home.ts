import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, goals, members, spaces, tasks } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { addDays, dateParam, getMembership } from "./_lib/space.js";

// Everything the Home page needs in one request.
// The client sends its local day/week boundaries (ISO), since "today" depends on its timezone:
//   GET /api/home?dayStart=2026-10-30T00:00:00+01:00&weekStart=2026-10-26T00:00:00+01:00
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const me = await getMembership(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const now = new Date();
  const utcToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const url = new URL(req.url);
  const dayStart = dateParam(url, "dayStart", utcToday);
  const weekStart = dateParam(
    url,
    "weekStart",
    addDays(utcToday, -((utcToday.getUTCDay() + 6) % 7)), // Monday
  );
  const weekEnd = addDays(weekStart, 7);

  const [[space], people, spaceGoals, [open], todayTasks, weekEvents] =
    await Promise.all([
      db.select().from(spaces).where(eq(spaces.id, me.spaceId)),
      db
        .select({
          userId: members.clerkUserId,
          displayName: members.displayName,
          role: members.role,
        })
        .from(members)
        .where(eq(members.spaceId, me.spaceId)),
      db.select().from(goals).where(eq(goals.spaceId, me.spaceId)),
      db
        .select({ n: count() })
        .from(tasks)
        .where(and(eq(tasks.spaceId, me.spaceId), eq(tasks.done, false))),
      db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.spaceId, me.spaceId),
            gte(tasks.dueAt, dayStart),
            lt(tasks.dueAt, addDays(dayStart, 1)),
          ),
        )
        .orderBy(asc(tasks.dueAt)),
      db
        .select()
        .from(events)
        .where(
          and(
            eq(events.spaceId, me.spaceId),
            gte(events.startsAt, weekStart),
            lt(events.startsAt, weekEnd),
          ),
        )
        .orderBy(asc(events.startsAt)),
    ]);

  const featured = spaceGoals.find((g) => g.featured);

  return json({
    space: {
      id: space.id,
      name: space.name,
      focus: space.focus,
      checkInDay: space.checkInDay,
    },
    members: people,
    stats: {
      activeGoals: spaceGoals.length,
      tasksLeft: open.n,
      upcomingEvents: weekEvents.filter((e) => e.startsAt >= now).length,
    },
    adventure: featured
      ? {
          goalId: featured.id,
          title: featured.name,
          subtitle: featured.subtitle,
          progress: featured.targetCents
            ? Math.min(
                100,
                Math.round((featured.savedCents / featured.targetCents) * 100),
              )
            : 0,
        }
      : null,
    today: todayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      ownerUserId: t.ownerUserId, // null = both of you
      status: t.status,
      done: t.done,
      dueAt: t.dueAt,
    })),
    week: {
      start: weekStart,
      events: weekEvents.map((e) => ({
        id: e.id,
        title: e.title,
        kind: e.kind,
        startsAt: e.startsAt,
      })),
    },
  });
}
