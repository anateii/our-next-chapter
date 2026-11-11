import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  budgets,
  contributions,
  expenses,
  funds,
  goals,
  members,
  settlements,
  spaces,
} from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership, isMember } from "./_lib/space.js";
import { logActivity } from "./_lib/activity.js";

// Everything on the Finances page goes through this one endpoint (the Vercel
// Hobby plan allows 12 functions). Writes say what they're about with `type`:
//   POST   { type: "fund" | "contribution" | "expense" | "settlement", ... }
//   PATCH  { type: "fund" | "expense", id, ... }  or  { type: "settings", budgets?, incomeSplit? }
//   DELETE ?type=fund|contribution|expense|settlement&id=...

// "home" is Rent. Keep in step with `categories` in src/helpers/finances.ts.
const CATEGORIES = [
  "home",
  "utilities",
  "subscriptions",
  "transport",
  "health",
  "food",
  "out",
  "travel",
  "other",
] as const;
const SPLITS = ["equal", "income", "owner", "partner"] as const;
type Category = (typeof CATEGORIES)[number];
type Split = (typeof SPLITS)[number];
const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category);
const isSplit = (v: unknown): v is Split => SPLITS.includes(v as Split);

const MAX_CENTS = 100_000_000; // €1,000,000
const isCents = (v: unknown, allowNegative = false): v is number =>
  Number.isInteger(v) &&
  Math.abs(v as number) <= MAX_CENTS &&
  (allowNegative ? v !== 0 : (v as number) > 0);
const isDay = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`;

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me, userId };
}
type Me = typeof members.$inferSelect;

const toFund = (f: typeof funds.$inferSelect) => ({
  id: f.id,
  name: f.name,
  goalId: f.goalId,
  targetCents: f.targetCents,
  monthlyCents: f.monthlyCents,
});
const toContribution = (c: typeof contributions.$inferSelect) => ({
  id: c.id,
  fundId: c.fundId,
  userId: c.userId,
  cents: c.cents,
  at: c.createdAt,
});
const toExpense = (x: typeof expenses.$inferSelect) => ({
  id: x.id,
  title: x.title,
  cents: x.cents,
  category: x.category,
  paidBy: x.paidBy,
  split: x.split,
  ownerShare: x.ownerShare,
  day: x.day,
});
const toSettlement = (s: typeof settlements.$inferSelect) => ({
  id: s.id,
  fromUserId: s.fromUserId,
  toUserId: s.toUserId,
  cents: s.cents,
  at: s.createdAt,
});

// The owner's share (percent) for a split; "income" uses the space's setting.
async function ownerShareFor(split: Split, spaceId: string) {
  if (split === "equal") return 50;
  if (split === "owner") return 100;
  if (split === "partner") return 0;
  const [space] = await db
    .select({ share: spaces.incomeSplitOwner })
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  return space?.share ?? 50;
}

// Everything the page shows. A couple's finances stay small, so it's all of it.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const [fundRows, contributionRows, expenseRows, settlementRows, budgetRows, [space]] =
    await Promise.all([
      db.select().from(funds).where(eq(funds.spaceId, me.spaceId)).orderBy(asc(funds.createdAt)),
      db.select().from(contributions).where(eq(contributions.spaceId, me.spaceId)).orderBy(asc(contributions.createdAt)),
      db.select().from(expenses).where(eq(expenses.spaceId, me.spaceId)).orderBy(asc(expenses.day), asc(expenses.createdAt)),
      db.select().from(settlements).where(eq(settlements.spaceId, me.spaceId)).orderBy(asc(settlements.createdAt)),
      db.select().from(budgets).where(eq(budgets.spaceId, me.spaceId)),
      db.select({ share: spaces.incomeSplitOwner }).from(spaces).where(eq(spaces.id, me.spaceId)),
    ]);

  return json({
    funds: fundRows.map(toFund),
    contributions: contributionRows.map(toContribution),
    expenses: expenseRows.map(toExpense),
    settlements: settlementRows.map(toSettlement),
    budgets: Object.fromEntries(budgetRows.map((b) => [b.category, b.cents])),
    incomeSplit: space?.share ?? 50,
  });
}

const isSpaceGoal = async (spaceId: string, goalId: unknown) => {
  if (goalId === null) return true;
  if (typeof goalId !== "string") return false;
  const [g] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId)));
  return Boolean(g);
};

// Fund fields from a body -> columns, or the first error. `required` for POST.
async function fundFields(body: Record<string, unknown>, spaceId: string, required: boolean) {
  const out: Partial<typeof funds.$inferInsert> = {};
  if (required || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) return { error: "Give the fund a name (up to 60 characters)" };
    out.name = name;
  }
  if (required || "targetCents" in body) {
    if (!isCents(body.targetCents)) return { error: "targetCents must be a whole number of cents above 0" };
    out.targetCents = body.targetCents;
  }
  if ("monthlyCents" in body) {
    if (!(body.monthlyCents === 0 || isCents(body.monthlyCents)))
      return { error: "monthlyCents must be 0 or more cents" };
    out.monthlyCents = body.monthlyCents as number;
  }
  if ("goalId" in body) {
    const goalId = body.goalId ?? null;
    if (!(await isSpaceGoal(spaceId, goalId))) return { error: "Goal must be in your space" };
    out.goalId = goalId as string | null;
  }
  return { fields: out };
}

// Expense fields from a body -> columns, or the first error. `required` for POST.
async function expenseFields(body: Record<string, unknown>, spaceId: string, required: boolean) {
  const out: Partial<typeof expenses.$inferInsert> = {};
  if (required || "title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 80) return { error: "Say what it was (up to 80 characters)" };
    out.title = title;
  }
  if (required || "cents" in body) {
    if (!isCents(body.cents)) return { error: "cents must be a whole number above 0" };
    out.cents = body.cents;
  }
  if (required || "day" in body) {
    if (!isDay(body.day)) return { error: "day must be a date like 2026-11-04" };
    out.day = body.day;
  }
  if ("category" in body) {
    if (!isCategory(body.category)) return { error: `category must be one of ${CATEGORIES.join(", ")}` };
    out.category = body.category;
  }
  if (required || "paidBy" in body) {
    if (typeof body.paidBy !== "string" || !(await isMember(spaceId, body.paidBy)))
      return { error: "paidBy must be someone in your space" };
    out.paidBy = body.paidBy;
  }
  if (required || "split" in body) {
    const split = body.split ?? "equal";
    if (!isSplit(split)) return { error: `split must be one of ${SPLITS.join(", ")}` };
    out.split = split;
    out.ownerShare = await ownerShareFor(split, spaceId);
  }
  return { fields: out };
}

export async function POST(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Send { type, ... }" }, 400);
  const log = { spaceId: me.spaceId, actorUserId: userId };

  switch (body.type) {
    case "fund": {
      const parsed = await fundFields(body, me.spaceId, true);
      if ("error" in parsed) return json({ error: parsed.error }, 400);
      const [fund] = await db
        .insert(funds)
        .values({ spaceId: me.spaceId, name: parsed.fields.name!, targetCents: parsed.fields.targetCents!, ...parsed.fields })
        .returning();
      return json({ fund: toFund(fund) }, 201);
    }
    case "contribution": {
      if (!isCents(body.cents, true)) return json({ error: "cents must be a whole number, not 0" }, 400);
      const who = body.userId ?? userId;
      if (typeof who !== "string" || !(await isMember(me.spaceId, who)))
        return json({ error: "userId must be someone in your space" }, 400);
      const [fund] = await db
        .select()
        .from(funds)
        .where(and(eq(funds.id, String(body.fundId)), eq(funds.spaceId, me.spaceId)));
      if (!fund) return json({ error: "Fund not found" }, 404);
      const [c] = await db
        .insert(contributions)
        .values({ spaceId: me.spaceId, fundId: fund.id, userId: who, cents: body.cents })
        .returning();
      if (c.cents > 0)
        await logActivity({ ...log, kind: "savings_added", title: `${euros(c.cents)} to ${fund.name}`, goalId: fund.goalId });
      return json({ contribution: toContribution(c) }, 201);
    }
    case "expense": {
      const parsed = await expenseFields(body, me.spaceId, true);
      if ("error" in parsed) return json({ error: parsed.error }, 400);
      const f = parsed.fields;
      const [x] = await db
        .insert(expenses)
        .values({ ...f, spaceId: me.spaceId, title: f.title!, cents: f.cents!, day: f.day!, paidBy: f.paidBy!, createdBy: userId })
        .returning();
      await logActivity({ ...log, kind: "expense_added", title: `${x.title} (${euros(x.cents)})` });
      return json({ expense: toExpense(x) }, 201);
    }
    case "settlement": {
      if (!isCents(body.cents)) return json({ error: "cents must be a whole number above 0" }, 400);
      const { fromUserId, toUserId } = body;
      const valid =
        typeof fromUserId === "string" &&
        typeof toUserId === "string" &&
        fromUserId !== toUserId &&
        (await isMember(me.spaceId, fromUserId)) &&
        (await isMember(me.spaceId, toUserId));
      if (!valid) return json({ error: "fromUserId and toUserId must be the two of you" }, 400);
      // Optional `at`: when Undo puts back a removed settle-up, it keeps its original date.
      const at = body.at === undefined ? undefined : new Date(String(body.at));
      if (at && (Number.isNaN(at.getTime()) || at > new Date()))
        return json({ error: "at must be a past date (ISO)" }, 400);
      const [s] = await db
        .insert(settlements)
        .values({ spaceId: me.spaceId, fromUserId, toUserId, cents: body.cents, ...(at ? { createdAt: at } : {}) })
        .returning();
      await logActivity({ ...log, kind: "settled", title: euros(s.cents) });
      return json({ settlement: toSettlement(s) }, 201);
    }
    default:
      return json({ error: "type must be fund, contribution, expense or settlement" }, 400);
  }
}

async function saveSettings(body: Record<string, unknown>, me: Me) {
  if ("incomeSplit" in body) {
    const share = body.incomeSplit;
    if (!(Number.isInteger(share) && (share as number) >= 0 && (share as number) <= 100))
      return json({ error: "incomeSplit must be a whole percent from 0 to 100" }, 400);
    await db.update(spaces).set({ incomeSplitOwner: share as number }).where(eq(spaces.id, me.spaceId));
  }
  if ("budgets" in body) {
    const entries = Object.entries((body.budgets ?? {}) as Record<string, unknown>);
    for (const [category, cents] of entries)
      if (!isCategory(category) || !(cents === 0 || isCents(cents)))
        return json({ error: "budgets must map categories to 0 or more cents" }, 400);
    for (const [category, cents] of entries)
      await db
        .insert(budgets)
        .values({ spaceId: me.spaceId, category, cents: cents as number })
        .onConflictDoUpdate({ target: [budgets.spaceId, budgets.category], set: { cents: cents as number } });
  }
  return json({ ok: true });
}

export async function PATCH(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Send { type, ... }" }, 400);

  if (body.type === "settings") return saveSettings(body, me);
  if (typeof body.id !== "string") return json({ error: "Send { type, id, ... }" }, 400);

  if (body.type === "fund") {
    const parsed = await fundFields(body, me.spaceId, false);
    if ("error" in parsed) return json({ error: parsed.error }, 400);
    const mine = and(eq(funds.id, body.id), eq(funds.spaceId, me.spaceId));
    const [fund] = Object.keys(parsed.fields).length
      ? await db.update(funds).set(parsed.fields).where(mine).returning()
      : await db.select().from(funds).where(mine);
    if (!fund) return json({ error: "Fund not found" }, 404);
    return json({ fund: toFund(fund) });
  }
  if (body.type === "expense") {
    const parsed = await expenseFields(body, me.spaceId, false);
    if ("error" in parsed) return json({ error: parsed.error }, 400);
    const mine = and(eq(expenses.id, body.id), eq(expenses.spaceId, me.spaceId));
    const [x] = Object.keys(parsed.fields).length
      ? await db.update(expenses).set(parsed.fields).where(mine).returning()
      : await db.select().from(expenses).where(mine);
    if (!x) return json({ error: "Expense not found" }, 404);
    return json({ expense: toExpense(x) });
  }
  return json({ error: "type must be fund, expense or settings" }, 400);
}

export async function DELETE(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  if (!id) return json({ error: "Send ?type=&id=" }, 400);

  const tables = { fund: funds, contribution: contributions, expense: expenses, settlement: settlements };
  const table = tables[params.get("type") as keyof typeof tables];
  if (!table) return json({ error: "type must be fund, contribution, expense or settlement" }, 400);
  const [row] = await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.spaceId, me.spaceId)))
    .returning({ id: table.id });
  if (!row) return json({ error: "Not found" }, 404);
  return json({ ok: true });
}
