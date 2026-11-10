import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  checkins,
  members,
  milestones,
  spaces,
  wins,
  type CheckInAnswers,
} from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership, isEmoji } from "./_lib/space.js";
import { logActivity } from "./_lib/activity.js";

// Everything on the Our Space page goes through this one endpoint (the Vercel
// Hobby plan allows 12 functions). Writes say what they're about with `type`:
//   POST   { type: "milestone" | "win" | "checkin", ... }
//   PATCH  { type: "milestone" | "win", id, ... }
//          { type: "space", name?, focus?, checkInDay?, checkInEvery? }
//          { type: "member", displayName }   your name, as your partner sees it
//          { type: "roadmap", milestones: [{ id, title, icon, emoji, status, when }], deleted: [id] }
//   DELETE ?type=milestone|win|checkin&id=...

// Keep in step with src/helpers/ourspace.ts.
const STATUSES = ["Done", "In progress", "Up next", "Planning", "Date to decide"] as const;
const ICONS = ["car", "job", "home", "plane", "people", "star"] as const;
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
// Like str(), but "" and null clear the field (-> null).
const optStr = (v: unknown, max: number) =>
  v === null || (typeof v === "string" && !v.trim()) ? null : str(v, max);
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

const toMilestone = (m: typeof milestones.$inferSelect) => ({
  id: m.id,
  title: m.title,
  icon: m.icon,
  emoji: m.emoji,
  status: m.status,
  when: m.whenText,
});
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

// Everything the page shows. Focus, name and check-in day come with /api/home.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const s = me.spaceId;

  const [ms, ws, cs] = await Promise.all([
    db.select().from(milestones).where(eq(milestones.spaceId, s)).orderBy(asc(milestones.position)),
    db.select().from(wins).where(eq(wins.spaceId, s)).orderBy(desc(wins.createdAt)),
    db.select().from(checkins).where(eq(checkins.spaceId, s)).orderBy(desc(checkins.createdAt)).limit(HISTORY),
  ]);

  return json({
    milestones: ms.map(toMilestone),
    wins: ws.map(toWin),
    checkins: cs.map(toCheckin),
  });
}

/* Milestones */

async function addMilestone(me: Me, b: Body) {
  const title = str(b.title, 60);
  if (!title) return bad("title must be 1-60 characters");
  const [{ last }] = await db
    .select({ last: max(milestones.position) })
    .from(milestones)
    .where(eq(milestones.spaceId, me.spaceId));
  const [m] = await db
    .insert(milestones)
    .values({
      spaceId: me.spaceId,
      title,
      icon: oneOf(ICONS, b.icon) ? b.icon : "star",
      emoji: isEmoji(b.emoji) ? b.emoji : null,
      status: oneOf(STATUSES, b.status) ? b.status : "Planning",
      whenText: optStr(b.when, 40) ?? null,
      position: (last ?? -1) + 1,
    })
    .returning();
  return json({ milestone: toMilestone(m) }, 201);
}

async function editMilestone(me: Me, id: string, b: Body) {
  const set: Partial<typeof milestones.$inferInsert> = {};
  if ("title" in b) {
    const title = str(b.title, 60);
    if (!title) return bad("title must be 1-60 characters");
    set.title = title;
  }
  if ("status" in b) {
    if (!oneOf(STATUSES, b.status)) return bad(`status must be one of: ${STATUSES.join(", ")}`);
    set.status = b.status;
  }
  if ("icon" in b) {
    if (!oneOf(ICONS, b.icon)) return bad(`icon must be one of: ${ICONS.join(", ")}`);
    set.icon = b.icon;
  }
  if ("emoji" in b) {
    if (b.emoji !== null && !isEmoji(b.emoji)) return bad("emoji must be a single emoji or null");
    set.emoji = b.emoji;
  }
  if ("when" in b) {
    const when = optStr(b.when, 40);
    if (when === undefined) return bad("when must be at most 40 characters");
    set.whenText = when;
  }
  if (!Object.keys(set).length) return bad("Nothing to change");
  const [m] = await db
    .update(milestones)
    .set(set)
    .where(and(eq(milestones.id, id), eq(milestones.spaceId, me.spaceId)))
    .returning();
  return m ? json({ milestone: toMilestone(m) }) : notFound();
}

// The Edit roadmap dialog: the milestones it showed, in their new order, with
// their names, emojis, statuses and timing, plus the ids it deleted. Only
// those are deleted: a milestone added meanwhile (say, by your partner) isn't
// in either list, so it's kept and placed after the others. One transaction.
async function saveRoadmap(me: Me, b: Body) {
  if (!Array.isArray(b.milestones)) return bad("milestones must be a list");
  const deleted = b.deleted ?? [];
  if (!Array.isArray(deleted) || deleted.some((d) => typeof d !== "string"))
    return bad("deleted must be a list of milestone ids");
  const rows: {
    id: string;
    title: string;
    icon: (typeof ICONS)[number];
    emoji: string | null;
    status: (typeof STATUSES)[number];
    whenText: string | null;
  }[] = [];
  for (const m of b.milestones as Body[]) {
    const title = str(m?.title, 60);
    const when = optStr(m?.when ?? null, 40);
    if (
      typeof m?.id !== "string" ||
      !title ||
      when === undefined ||
      !oneOf(ICONS, m.icon) ||
      !oneOf(STATUSES, m.status) ||
      (m.emoji != null && !isEmoji(m.emoji))
    )
      return bad("each milestone needs an id, a title (1-60), an icon, a status and an optional when (up to 40)");
    rows.push({ id: m.id, title, icon: m.icon, emoji: (m.emoji as string | null | undefined) ?? null, status: m.status, whenText: when });
  }
  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) return bad("a milestone is listed twice");
  const gone = new Set(deleted as string[]);
  if (ids.some((id) => gone.has(id))) return bad("a milestone can't be both kept and deleted");

  // Milestones the dialog didn't know about keep their order, after the edited ones.
  const others = (
    await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(eq(milestones.spaceId, me.spaceId))
      .orderBy(asc(milestones.position))
  ).filter((m) => !ids.includes(m.id) && !gone.has(m.id));

  const inSpace = eq(milestones.spaceId, me.spaceId);
  const queries = [
    // A listed id that no longer exists (deleted meanwhile) just updates nothing.
    ...(gone.size ? [db.delete(milestones).where(and(inSpace, inArray(milestones.id, [...gone])))] : []),
    ...rows.map((r, position) =>
      db
        .update(milestones)
        .set({ title: r.title, icon: r.icon, emoji: r.emoji, status: r.status, whenText: r.whenText, position })
        .where(and(eq(milestones.id, r.id), inSpace)),
    ),
    ...others.map((m, i) =>
      db
        .update(milestones)
        .set({ position: rows.length + i })
        .where(and(eq(milestones.id, m.id), inSpace)),
    ),
  ];
  const [first, ...rest] = queries;
  if (first) await db.batch([first, ...rest]);
  return json({ ok: true });
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

/* The space itself: any of its name, focus line and check-in schedule (Settings and Our Space) */

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
  if ("focus" in b) {
    const focus = optStr(b.focus, 140);
    if (focus === undefined) return bad("focus must be at most 140 characters");
    set.focus = focus;
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
    space: { name: s.name, focus: s.focus, checkInDay: s.checkInDay, checkInEvery: s.checkInEvery },
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
    case "milestone":
      return addMilestone(me, b);
    case "win":
      return addWin(me, userId, b);
    case "checkin":
      return addCheckin(me, userId, b);
    default:
      return bad("type must be milestone, win or checkin");
  }
}

export async function PATCH(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;
  const b: Body = await req.json().catch(() => ({}));
  if (b.type === "space") return editSpace(me, b);
  if (b.type === "member") return editMember(me, b);
  if (b.type === "roadmap") return saveRoadmap(me, b);
  if (typeof b.id !== "string") return bad("id is required");
  switch (b.type) {
    case "milestone":
      return editMilestone(me, b.id, b);
    case "win":
      return editWin(me, userId, b.id, b);
    default:
      return bad("type must be space, milestone or win");
  }
}

const tables = { milestone: milestones, win: wins, checkin: checkins };

export async function DELETE(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as keyof typeof tables | null;
  const id = url.searchParams.get("id");
  const table = type && tables[type];
  if (!table || !id) return bad("type (milestone, win or checkin) and id are required");
  const [gone] = await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.spaceId, me.spaceId)))
    .returning({ id: table.id });
  if (!gone) return notFound();
  return json({ ok: true });
}
