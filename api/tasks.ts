import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { members, tasks } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership } from "./_lib/space.js";

// Create a task: { title, ownerUserId?: string | null, dueAt?: ISO string | null }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const me = await getMembership(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200)
    return json({ error: "Give the task a title (up to 200 characters)" }, 400);

  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime()))
    return json({ error: "dueAt must be a valid date" }, 400);

  const ownerUserId: string | null = body?.ownerUserId ?? null;
  if (ownerUserId) {
    const [owner] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.spaceId, me.spaceId),
          eq(members.clerkUserId, ownerUserId),
        ),
      );
    if (!owner) return json({ error: "Owner must be in your space" }, 400);
  }

  const [task] = await db
    .insert(tasks)
    .values({ spaceId: me.spaceId, title, ownerUserId, dueAt })
    .returning();
  return json({ task }, 201);
}

// Tick a task on or off: { id, done }
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const me = await getMembership(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string" || typeof body?.done !== "boolean")
    return json({ error: "Send { id, done }" }, 400);

  const [task] = await db
    .update(tasks)
    .set({ done: body.done, status: body.done ? "Done" : "To do" })
    .where(and(eq(tasks.id, body.id), eq(tasks.spaceId, me.spaceId)))
    .returning();
  if (!task) return json({ error: "Task not found" }, 404);

  return json({ task });
}
