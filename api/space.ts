import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { invites, members, milestones, spaces } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { isEmoji } from "./_lib/space.js";

// Your space and who's in it, in one endpoint (the Vercel Hobby plan allows
// 12 functions):
//   GET  /api/space                                  -> { userId, space, role }
//   POST /api/space { action: "create", name, displayName,     start a space
//                     focus?, checkInDay?, checkInEvery?, milestones? }
//   POST /api/space { action: "invite" }                       a code for your partner
//   POST /api/space { action: "join", code, displayName }     join with a code

// Which space you're in (null = new user: show onboarding).
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const rows = await db
    .select({ space: spaces, role: members.role })
    .from(members)
    .innerJoin(spaces, eq(members.spaceId, spaces.id))
    .where(eq(members.clerkUserId, userId))
    .limit(1);

  return json({
    userId,
    space: rows[0]?.space ?? null,
    role: rows[0]?.role ?? null,
  });
}

const memberOf = async (userId: string) => {
  const [me] = await db.select().from(members).where(eq(members.clerkUserId, userId));
  return me;
};

// Keep in step with src/helpers/checkins.ts and api/ourspace.ts.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQUENCIES = ["weekly", "biweekly", "monthly"];
const ICONS = ["car", "job", "home", "plane", "people", "star"] as const;
const MAX_MILESTONES = 8;

const text = (v: unknown, max: number) => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t && t.length <= max ? t : undefined;
};

type NewMilestone = { title: string; icon: (typeof ICONS)[number]; emoji: string | null; whenText: string | null };

// The roadmap from onboarding: [{ title, icon?, emoji?, when? }], in order. undefined = invalid.
function parseMilestones(v: unknown): NewMilestone[] | undefined {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > MAX_MILESTONES) return undefined;
  const out: NewMilestone[] = [];
  for (const m of v as Record<string, unknown>[]) {
    const title = text(m?.title, 60);
    if (!title) return undefined;
    const when = m.when === undefined || m.when === "" ? null : text(m.when, 40);
    if (when === undefined) return undefined;
    const icon = ICONS.includes(m.icon as NewMilestone["icon"]) ? (m.icon as NewMilestone["icon"]) : "star";
    out.push({ title, icon, emoji: isEmoji(m.emoji) ? m.emoji : null, whenText: when });
  }
  return out;
}

// Start a space, with you as its owner, plus what onboarding asked: the
// focus line, the check-in schedule and the first roadmap milestones.
// All of it is saved together or not at all. One space per person.
async function create(
  userId: string,
  body: {
    name?: unknown;
    displayName?: unknown;
    focus?: unknown;
    checkInDay?: unknown;
    checkInEvery?: unknown;
    milestones?: unknown;
  },
) {
  if (await memberOf(userId)) return json({ error: "You already have a space" }, 409);

  const focus = body.focus === undefined || body.focus === "" ? null : text(body.focus, 140);
  if (focus === undefined) return json({ error: "focus must be at most 140 characters" }, 400);
  const checkInDay = body.checkInDay ?? "Sunday";
  if (!WEEKDAYS.includes(checkInDay as string))
    return json({ error: "checkInDay must be a weekday name" }, 400);
  const checkInEvery = body.checkInEvery ?? "weekly";
  if (!FREQUENCIES.includes(checkInEvery as string))
    return json({ error: `checkInEvery must be one of: ${FREQUENCIES.join(", ")}` }, 400);
  const roadmap = parseMilestones(body.milestones);
  if (!roadmap)
    return json(
      { error: `milestones must be up to ${MAX_MILESTONES} of { title (1-60), when? (up to 40) }` },
      400,
    );

  const spaceId = crypto.randomUUID();
  const [[space]] = await db.batch([
    db
      .insert(spaces)
      .values({
        id: spaceId,
        name: String(body.name ?? ""),
        focus,
        checkInDay: checkInDay as string,
        checkInEvery: checkInEvery as string,
        onboarded: true,
      })
      .returning(),
    db.insert(members).values({
      spaceId,
      clerkUserId: userId,
      displayName: typeof body.displayName === "string" ? body.displayName : null,
      role: "owner",
    }),
    ...(roadmap.length
      ? [db.insert(milestones).values(roadmap.map((m, position) => ({ ...m, spaceId, position })))]
      : []),
  ]);
  return json({ space }, 201);
}

// A one-time code your partner enters to join, valid for 7 days.
async function invite(userId: string) {
  const me = await memberOf(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const code = crypto.randomUUID().slice(0, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(invites).values({ code, spaceId: me.spaceId, expiresAt });
  return json({ code, expiresAt }, 201);
}

// Join your partner's space with their code. The error messages are shown
// to the person as they are (see joinErrors in Onboarding.tsx).
async function join(userId: string, body: { code?: unknown; displayName?: unknown }) {
  const code = String(body.code ?? "");
  const [found] = await db.select().from(invites).where(eq(invites.code, code));
  if (!found) return json({ error: "Invalid code" }, 404);
  if (found.usedAt) return json({ error: "Code already used" }, 410);
  if (found.expiresAt < new Date()) return json({ error: "Code expired" }, 410);

  if (await memberOf(userId)) return json({ error: "You already have a space" }, 409);

  await db.insert(members).values({
    spaceId: found.spaceId,
    clerkUserId: userId,
    displayName: typeof body.displayName === "string" ? body.displayName : null,
    role: "partner",
  });
  await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.code, code));
  return json({ spaceId: found.spaceId }, 201);
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const body = await req.json().catch(() => ({}));
  switch (body?.action) {
    case "create":
      return create(userId, body);
    case "invite":
      return invite(userId);
    case "join":
      return join(userId, body);
    default:
      return json({ error: "action must be create, invite or join" }, 400);
  }
}
