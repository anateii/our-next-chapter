import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  checkins,
  members,
  spaces,
  wins,
  type CheckInAnswers,
} from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership } from "./_lib/space.js";
import { logActivity } from "./_lib/activity.js";

// Everything on the Our Space page goes through this one endpoint (the Vercel
// Hobby plan allows 12 functions). Writes say what they're about with `type`:
//   POST   { type: "win" | "checkin", ... }
//   PATCH  { type: "win", id, ... }
//          { type: "space", name?, checkInDay?, checkInEvery? }
//          { type: "member", displayName }   your name, as your partner sees it
//   DELETE ?type=win|checkin&id=...
// The milestones table and spaces.focus stay in the database (no data is
// dropped) but nothing reads or writes them since the roadmap and focus were removed.

// Keep in step with src/helpers/ourspace.ts.
const MOODS = ["Great", "Good", "Okay", "Tough"] as const;
const HISTORY = 12; // check-ins sent to the page

type Me = typeof members.$inferSelect;
type Body = Record<string, unknown>;

// A trimmed string of 1..max characters, or undefined.
const str = (v: unknown, max: number) => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t && t.length <= max ? t : undefined;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  list.includes(v as T);
const bad = (error: string) => json({ error }, 400);
const notFound = () => json({ error: "Not found" }, 404);

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me, userId };
}

const toWin = (w: typeof wins.$inferSelect) => ({
  id: w.id,
  text: w.text,
  userId: w.userId,
  cheers: w.cheers,
  at: w.createdAt,
});
const toCheckin = (c: typeof checkins.$inferSelect) => ({
  id: c.id,
  answers: c.answers,
  at: c.createdAt,
});

// Everything the page shows. Name and check-in day come with /api/home.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const s = me.spaceId;

  const [ws, cs] = await Promise.all([
    db.select().from(wins).where(eq(wins.spaceId, s)).orderBy(desc(wins.createdAt)),
    db.select().from(checkins).where(eq(checkins.spaceId, s)).orderBy(desc(checkins.createdAt)).limit(HISTORY),
  ]);

  return json({
    wins: ws.map(toWin),
    checkins: cs.map(toCheckin),
  });
}

/* Wins */

async function addWin(me: Me, userId: string, b: Body) {
  const text = str(b.text, 120);
  if (!text) return bad("text must be 1-120 characters");
  const [w] = await db.insert(wins).values({ spaceId: me.spaceId, text, userId }).returning();
  await logActivity({ spaceId: me.spaceId, actorUserId: userId, kind: "win_added", title: text });
  return json({ win: toWin(w) }, 201);
}

// `cheer: true | false` adds or removes your cheer.
async function editWin(me: Me, userId: string, id: string, b: Body) {
  if (typeof b.cheer !== "boolean") return bad("cheer must be true or false");
  const [w] = await db
    .select()
    .from(wins)
    .where(and(eq(wins.id, id), eq(wins.spaceId, me.spaceId)));
  if (!w) return notFound();
  const cheers = [...w.cheers.filter((c) => c !== userId), ...(b.cheer ? [userId] : [])];
  const [saved] = await db.update(wins).set({ cheers }).where(eq(wins.id, id)).returning();
  return json({ win: toWin(saved) });
}

/* Check-ins */

async function addCheckin(me: Me, userId: string, b: Body) {
  const raw = (b.answers ?? {}) as Record<string, Record<string, unknown>>;
  const answers: CheckInAnswers = {};
  for (const role of ["owner", "partner"] as const) {
    const a = raw[role];
    if (!a) continue;
    if (!oneOf(MOODS, a.mood)) return bad(`mood must be one of: ${MOODS.join(", ")}`);
    const text = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim().slice(0, 300) : "");
    answers[role] = { mood: a.mood, good: text("good"), hard: text("hard"), next: text("next") };
  }
  if (!answers.owner && !answers.partner) return bad("answers needs at least one person's mood");
  const [c] = await db
    .insert(checkins)
    .values({ spaceId: me.spaceId, answers, createdBy: userId })
    .returning();
  await logActivity({ spaceId: me.spaceId, actorUserId: userId, kind: "checkin_done", title: "Weekly check-in" });
  return json({ checkin: toCheckin(c) }, 201);
}

/* The space itself: its name and check-in schedule (Settings) */

// Keep in step with src/helpers/checkins.ts and api/space.ts.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQUENCIES = ["weekly", "biweekly", "monthly"];

async function editSpace(me: Me, b: Body) {
  const set: Partial<typeof spaces.$inferInsert> = {};
  if ("name" in b) {
    const name = str(b.name, 60);
    if (name === undefined) return bad("name must be 1-60 characters");
    set.name = name;
  }
  if ("checkInDay" in b) {
    if (!oneOf(WEEKDAYS, b.checkInDay)) return bad("checkInDay must be a weekday name");
    set.checkInDay = b.checkInDay;
  }
  if ("checkInEvery" in b) {
    if (!oneOf(FREQUENCIES, b.checkInEvery))
      return bad(`checkInEvery must be one of: ${FREQUENCIES.join(", ")}`);
    set.checkInEvery = b.checkInEvery;
  }
  if (!Object.keys(set).length) return bad("nothing to change");
  const [s] = await db.update(spaces).set(set).where(eq(spaces.id, me.spaceId)).returning();
  return json({
    space: { name: s.name, checkInDay: s.checkInDay, checkInEvery: s.checkInEvery },
  });
}

/* You in this space: the name your partner sees */

async function editMember(me: Me, b: Body) {
  const displayName = str(b.displayName, 40);
  if (displayName === undefined) return bad("displayName must be 1-40 characters");
  await db
    .update(members)
    .set({ displayName })
    .where(and(eq(members.spaceId, me.spaceId), eq(members.clerkUserId, me.clerkUserId)));
  return json({ member: { displayName } });
}

export async function POST(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;
  const b: Body = await req.json().catch(() => ({}));
  switch (b.type) {
    case "win":
      return addWin(me, userId, b);
    case "checkin":
      return addCheckin(me, userId, b);
    default:
      return bad("type must be win or checkin");
  }
}

export async function PATCH(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;
  const b: Body = await req.json().catch(() => ({}));
  if (b.type === "space") return editSpace(me, b);
  if (b.type === "member") return editMember(me, b);
  if (typeof b.id !== "string") return bad("id is required");
  switch (b.type) {
    case "win":
      return editWin(me, userId, b.id, b);
    default:
      return bad("type must be space, member or win");
  }
}

const tables = { win: wins, checkin: checkins };

export async function DELETE(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as keyof typeof tables | null;
  const id = url.searchParams.get("id");
  const table = type && tables[type];
  if (!table || !id) return bad("type (win or checkin) and id are required");
  const [gone] = await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.spaceId, me.spaceId)))
    .returning({ id: table.id });
  if (!gone) return notFound();
  return json({ ok: true });
}
