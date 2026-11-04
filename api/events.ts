import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { eventKindEnum, events } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership, isMember } from "./_lib/space.js";
import { logActivity } from "./_lib/activity.js";

type Kind = (typeof eventKindEnum.enumValues)[number];
const isKind = (v: unknown): v is Kind => eventKindEnum.enumValues.includes(v as Kind);

const toClient = (e: typeof events.$inferSelect) => ({
  id: e.id,
  title: e.title,
  kind: e.kind,
  startsAt: e.startsAt, // ISO; local midnight when allDay
  allDay: e.allDay,
  ownerUserId: e.ownerUserId, // null = both of you
  notes: e.notes,
});

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me, userId };
}

type EventChanges = Partial<typeof events.$inferInsert>;

// The body's editable fields -> columns to set, or the first error.
// `required` makes title and startsAt mandatory (for POST).
async function parseFields(
  body: Record<string, unknown>,
  spaceId: string,
  required: boolean,
): Promise<{ changes: EventChanges } | { error: string }> {
  const changes: EventChanges = {};
  if (required || "title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) return { error: "Give the event a title (up to 200 characters)" };
    changes.title = title;
  }
  if (required || "startsAt" in body) {
    const startsAt = new Date(String(body.startsAt));
    if (Number.isNaN(startsAt.getTime())) return { error: "startsAt must be a valid date" };
    changes.startsAt = startsAt;
  }
  if ("allDay" in body) {
    if (typeof body.allDay !== "boolean") return { error: "allDay must be true or false" };
    changes.allDay = body.allDay;
  }
  if ("kind" in body) {
    if (!isKind(body.kind)) return { error: `kind must be one of: ${eventKindEnum.enumValues.join(", ")}` };
    changes.kind = body.kind;
  }
  if ("ownerUserId" in body) {
    const owner = body.ownerUserId ?? null;
    if (owner !== null && (typeof owner !== "string" || !(await isMember(spaceId, owner))))
      return { error: "ownerUserId must be someone in your space, or null" };
    changes.ownerUserId = owner;
  }
  if ("notes" in body)
    changes.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.slice(0, 1000) : null;
  return { changes };
}

// All of the space's events, soonest first. A couple's calendar stays small.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.spaceId, me.spaceId))
    .orderBy(asc(events.startsAt));
  return json({ events: rows.map(toClient) });
}

// Add an event:
// { title, startsAt: ISO, allDay?,
//   kind?: "appointment" | "work" | "travel" | "date" | "family" | "other" | "checkin",
//   ownerUserId?: string | null, notes? }
export async function POST(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Send { title, startsAt, ... }" }, 400);
  const parsed = await parseFields(body, me.spaceId, true);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const [event] = await db
    .insert(events)
    .values({
      spaceId: me.spaceId,
      title: parsed.changes.title!,
      startsAt: parsed.changes.startsAt!,
      ...parsed.changes,
      createdBy: userId,
    })
    .returning();
  await logActivity({
    spaceId: me.spaceId,
    actorUserId: userId,
    kind: "event_added",
    title: event.title,
    whenAt: event.allDay ? null : event.startsAt,
  });
  return json({ event: toClient(event) }, 201);
}

// Change an event; only the fields sent change: { id, title?, startsAt?, allDay?, kind?,
// ownerUserId?, notes? }
export async function PATCH(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string") return json({ error: "Send { id, ... }" }, 400);
  const parsed = await parseFields(body, me.spaceId, false);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const mine = and(eq(events.id, body.id), eq(events.spaceId, me.spaceId));
  const [event] = Object.keys(parsed.changes).length
    ? await db.update(events).set(parsed.changes).where(mine).returning()
    : await db.select().from(events).where(mine);
  if (!event) return json({ error: "Event not found" }, 404);
  return json({ event: toClient(event) });
}

// Delete an event: DELETE /api/events?id=...
export async function DELETE(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Send ?id=" }, 400);
  const [event] = await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.spaceId, me.spaceId)))
    .returning({ id: events.id });
  if (!event) return json({ error: "Event not found" }, 404);
  return json({ ok: true });
}
