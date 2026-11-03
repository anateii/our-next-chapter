import { and, asc, eq, gte, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { goals, tasks } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { dateParam, getMembership, isMember } from "./_lib/space.js";

const STATUSES = ["To do", "In progress", "Done"] as const;
type TaskStatus = (typeof STATUSES)[number];
const isStatus = (v: unknown): v is TaskStatus =>
  STATUSES.includes(v as TaskStatus);

const toClient = (t: typeof tasks.$inferSelect) => ({
  id: t.id,
  title: t.title,
  ownerUserId: t.ownerUserId, // null = both of you
  status: t.status,
  done: t.done,
  dueAt: t.dueAt, // ISO; local midnight = a day without a time
  goalId: t.goalId,
  notes: t.notes,
  createdBy: t.createdBy,
  createdAt: t.createdAt,
  doneAt: t.doneAt,
});

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me, userId };
}

const isSpaceGoal = async (spaceId: string, goalId: string) => {
  const [g] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId)));
  return Boolean(g);
};

const parseTitle = (v: unknown) => {
  const title = typeof v === "string" ? v.trim() : "";
  return title && title.length <= 200 ? title : null;
};
const parseNotes = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.slice(0, 2000) : null;

// Every open task, plus the ones finished since `doneSince` (ISO, default 7 days ago):
//   GET /api/tasks?doneSince=2026-10-27T00:00:00+01:00
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const doneSince = dateParam(
    new URL(req.url),
    "doneSince",
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.spaceId, me.spaceId),
        or(eq(tasks.done, false), gte(tasks.doneAt, doneSince)),
      ),
    )
    .orderBy(asc(tasks.dueAt), asc(tasks.createdAt));
  return json({ tasks: rows.map(toClient) });
}

// Create a task:
// { title, ownerUserId?: string | null, dueAt?: ISO | null, goalId?: string | null,
//   notes?: string, status?: 'To do' | 'In progress' | 'Done' }
export async function POST(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const title = parseTitle(body?.title);
  if (!title)
    return json({ error: "Give the task a title (up to 200 characters)" }, 400);

  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime()))
    return json({ error: "dueAt must be a valid date" }, 400);

  const ownerUserId: string | null = body?.ownerUserId ?? null;
  if (ownerUserId && !(await isMember(me.spaceId, ownerUserId)))
    return json({ error: "Owner must be in your space" }, 400);

  const goalId: string | null = body?.goalId ?? null;
  if (goalId && (typeof goalId !== "string" || !(await isSpaceGoal(me.spaceId, goalId))))
    return json({ error: "Goal must be in your space" }, 400);

  const status = body?.status ?? "To do";
  if (!isStatus(status))
    return json({ error: `status must be one of ${STATUSES.join(", ")}` }, 400);

  const done = status === "Done";
  const [task] = await db
    .insert(tasks)
    .values({
      spaceId: me.spaceId,
      title,
      ownerUserId,
      dueAt,
      goalId,
      notes: parseNotes(body?.notes),
      status,
      done,
      doneAt: done ? new Date() : null,
      createdBy: userId,
    })
    .returning();
  return json({ task: toClient(task) }, 201);
}

type TaskChanges = Partial<typeof tasks.$inferInsert>;

// The PATCH body's editable fields -> columns to set, or the first error.
async function parseChanges(
  body: Record<string, unknown>,
  spaceId: string,
): Promise<{ changes: TaskChanges; status?: TaskStatus } | { error: string }> {
  const changes: TaskChanges = {};
  if ("title" in body) {
    const title = parseTitle(body.title);
    if (!title) return { error: "Give the task a title (up to 200 characters)" };
    changes.title = title;
  }
  if ("ownerUserId" in body) {
    const owner = body.ownerUserId ?? null;
    const valid = owner === null || (typeof owner === "string" && (await isMember(spaceId, owner)));
    if (!valid) return { error: "Owner must be in your space" };
    changes.ownerUserId = owner;
  }
  if ("dueAt" in body) {
    const dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return { error: "dueAt must be a valid date, or null" };
    changes.dueAt = dueAt;
  }
  if ("goalId" in body) {
    const goalId = body.goalId ?? null;
    const valid = goalId === null || (typeof goalId === "string" && (await isSpaceGoal(spaceId, goalId)));
    if (!valid) return { error: "Goal must be in your space" };
    changes.goalId = goalId;
  }
  if ("notes" in body) changes.notes = parseNotes(body.notes);

  if ("status" in body) {
    if (!isStatus(body.status)) return { error: `status must be one of ${STATUSES.join(", ")}` };
    return { changes, status: body.status };
  }
  if ("done" in body) {
    if (typeof body.done !== "boolean") return { error: "done must be true or false" };
    return { changes, status: body.done ? "Done" : "To do" };
  }
  return { changes };
}

// Update a task. Every field is optional; only the ones sent change:
// { id, done?: boolean, status?, title?, ownerUserId?: string | null, dueAt?: ISO | null,
//   goalId?: string | null, notes?: string | null }
// `done` and `status` stay in sync: done = (status === 'Done').
export async function PATCH(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string") return json({ error: "Send { id, ... }" }, 400);
  const mine = and(eq(tasks.id, body.id), eq(tasks.spaceId, me.spaceId));

  // Validate everything before writing anything.
  const parsed = await parseChanges(body, me.spaceId);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { changes, status } = parsed;

  if (status) {
    const [existing] = await db.select({ done: tasks.done }).from(tasks).where(mine);
    if (!existing) return json({ error: "Task not found" }, 404);
    const done = status === "Done";
    Object.assign(changes, { status, done });
    // Keep the original time when a done task is saved as done again.
    if (done !== existing.done) changes.doneAt = done ? new Date() : null;
  }

  const [task] = Object.keys(changes).length
    ? await db.update(tasks).set(changes).where(mine).returning()
    : await db.select().from(tasks).where(mine);
  if (!task) return json({ error: "Task not found" }, 404);

  return json({ task: toClient(task) });
}

// Delete a task: DELETE /api/tasks?id=...
export async function DELETE(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Send ?id=" }, 400);

  const [task] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.spaceId, me.spaceId)))
    .returning({ id: tasks.id });
  if (!task) return json({ error: "Task not found" }, 404);

  return json({ ok: true });
}
