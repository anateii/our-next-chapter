import { db } from "../db/client.js";
import { eventKindEnum, events } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership } from "./_lib/space.js";
import { logActivity } from "./_lib/activity.js";

type Kind = (typeof eventKindEnum.enumValues)[number];

// Add a calendar event: { title, startsAt: ISO string, kind?: "home" | "food" | "checkin" | "other" }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const me = await getMembership(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200)
    return json({ error: "Give the event a title (up to 200 characters)" }, 400);

  const startsAt = new Date(body?.startsAt);
  if (Number.isNaN(startsAt.getTime()))
    return json({ error: "startsAt must be a valid date" }, 400);

  const kind: Kind = body?.kind ?? "other";
  if (!eventKindEnum.enumValues.includes(kind))
    return json(
      { error: `kind must be one of: ${eventKindEnum.enumValues.join(", ")}` },
      400,
    );

  const [event] = await db
    .insert(events)
    .values({ spaceId: me.spaceId, title, kind, startsAt })
    .returning();
  await logActivity({
    spaceId: me.spaceId,
    actorUserId: userId,
    kind: "event_added",
    title,
    whenAt: startsAt,
  });
  return json({ event }, 201);
}
