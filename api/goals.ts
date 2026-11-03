import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { goals, goalCategoryEnum } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership, isMember } from "./_lib/space.js";

type Category = (typeof goalCategoryEnum.enumValues)[number];
const isCategory = (v: unknown): v is Category =>
  goalCategoryEnum.enumValues.includes(v as Category);

// "YYYY-MM-DD" that is a real calendar day.
const isDay = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

const toClient = (g: typeof goals.$inferSelect) => ({
  id: g.id,
  title: g.name,
  subtitle: g.subtitle,
  category: g.category,
  ownerUserId: g.ownerUserId, // null = both of you
  stepsDone: g.stepsDone,
  stepsTotal: g.stepsTotal,
  nextStep: g.nextStep,
  image: g.imageUrl,
  targetDate: g.targetDate,
  savedCents: g.savedCents,
  targetCents: g.targetCents,
  featured: g.featured,
});

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me };
}

// List the space's goals, oldest first.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.spaceId, me.spaceId))
    .orderBy(asc(goals.createdAt));
  return json({ goals: rows.map(toClient) });
}

// Create a goal:
// { title, category?, ownerUserId?: string | null, nextStep?, targetDate?: "YYYY-MM-DD", targetCents? }
export async function POST(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 80)
    return json({ error: "Give the goal a name (up to 80 characters)" }, 400);

  const category = body?.category ?? "life";
  if (!isCategory(category))
    return json({ error: `category must be one of ${goalCategoryEnum.enumValues.join(", ")}` }, 400);

  const nextStep = typeof body?.nextStep === "string" ? body.nextStep.trim().slice(0, 120) : "";

  const targetDate = body?.targetDate ?? null;
  if (targetDate !== null && !isDay(targetDate))
    return json({ error: "targetDate must be a date like 2027-03-01" }, 400);

  const targetCents = body?.targetCents ?? null;
  if (targetCents !== null && !(Number.isInteger(targetCents) && targetCents > 0))
    return json({ error: "targetCents must be a positive whole number" }, 400);

  const ownerUserId: string | null = body?.ownerUserId ?? null;
  if (ownerUserId && !(await isMember(me.spaceId, ownerUserId)))
    return json({ error: "Owner must be in your space" }, 400);

  const [goal] = await db
    .insert(goals)
    .values({
      spaceId: me.spaceId,
      name: title,
      category,
      ownerUserId,
      nextStep: nextStep || null,
      stepsTotal: nextStep ? 1 : 0,
      targetDate,
      targetCents,
    })
    .returning();
  return json({ goal: toClient(goal) }, 201);
}

// Update a goal: { id, featured?: true, completed?: true, targetDate?: "YYYY-MM-DD" | null }
export async function PATCH(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string") return json({ error: "Send { id, ... }" }, 400);
  const mine = and(eq(goals.id, body.id), eq(goals.spaceId, me.spaceId));

  const [existing] = await db.select({ id: goals.id }).from(goals).where(mine);
  if (!existing) return json({ error: "Goal not found" }, 404);

  if (body.featured === true) {
    // One featured goal per space (unique index): clear the old one first, in one transaction.
    await db.batch([
      db
        .update(goals)
        .set({ featured: false })
        .where(and(eq(goals.spaceId, me.spaceId), eq(goals.featured, true))),
      db.update(goals).set({ featured: true }).where(mine),
    ]);
  }

  const changes: Partial<typeof goals.$inferInsert> = {};
  if (body.completed === true) {
    const total = sql`greatest(${goals.stepsTotal}, 1)`;
    Object.assign(changes, { stepsTotal: total, stepsDone: total, nextStep: null });
  }
  if ("targetDate" in body) {
    if (body.targetDate !== null && !isDay(body.targetDate))
      return json({ error: "targetDate must be a date like 2027-03-01, or null" }, 400);
    changes.targetDate = body.targetDate;
  }

  const [goal] = Object.keys(changes).length
    ? await db.update(goals).set(changes).where(mine).returning()
    : await db.select().from(goals).where(mine);
  return json({ goal: toClient(goal) });
}
