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
  startDay: f.startDay ?? f.createdAt.toISOString().slice(0, 10),
  endDay: f.endDay,
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

const fundFieldValue = <T>(
  body: Record<string, unknown>,
  key: string,
  required: boolean,
  validate: (value: unknown) => { ok: true; value: T } | { ok: false; error: string },
) => {
  if (!(required || key in body)) return { ok: true } as const;
  const result = validate(body[key]);
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error };
};

const fundName = (body: Record<string, unknown>, required: boolean) =>
  fundFieldValue(body, "name", required, (value) => {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name || name.length > 60) return { ok: false, error: "Give the fund a name (up to 60 characters)" };
    return { ok: true, value: name };
  });

const fundTarget = (body: Record<string, unknown>, required: boolean) =>
  fundFieldValue(body, "targetCents", required, (value) => {
    if (!isCents(value)) return { ok: false, error: "targetCents must be a whole number of cents above 0" };
    return { ok: true, value: value as number };
  });

const fundMonthly = (body: Record<string, unknown>) =>
  fundFieldValue(body, "monthlyCents", false, (value) => {
    if (!(value === 0 || isCents(value))) return { ok: false, error: "monthlyCents must be 0 or more cents" };
    return { ok: true, value: value as number };
  });

const fundStartDay = (body: Record<string, unknown>) =>
  fundFieldValue(body, "startDay", false, (value) => {
    if (!isDay(value)) return { ok: false, error: "startDay must be a date like 2026-11-04" };
    return { ok: true, value: value as string };
  });

const fundEndDay = (body: Record<string, unknown>) =>
  fundFieldValue(body, "endDay", false, (value = null) => {
    if (value !== null && !isDay(value)) return { ok: false, error: "endDay must be a date like 2027-06-30, or null" };
    return { ok: true, value: value as string | null };
  });

const fundGoal = async (body: Record<string, unknown>, spaceId: string) => {
  if (!("goalId" in body)) return { ok: true } as const;
  const goalId = body.goalId ?? null;
  if (!(await isSpaceGoal(spaceId, goalId))) return { ok: false, error: "Goal must be in your space" };
  return { ok: true, value: goalId as string | null };
};

// Fund fields from a body -> columns, or the first error. `required` for POST.
async function fundFields(body: Record<string, unknown>, spaceId: string, required: boolean) {
  const out: Partial<typeof funds.$inferInsert> = {};
  const name = fundName(body, required);
  if (!name.ok) return { error: name.error };
  if (name.value !== undefined) out.name = name.value;

  const target = fundTarget(body, required);
  if (!target.ok) return { error: target.error };
  if (target.value !== undefined) out.targetCents = target.value;

  const monthly = fundMonthly(body);
  if (!monthly.ok) return { error: monthly.error };
  if (monthly.value !== undefined) out.monthlyCents = monthly.value;

  const startDay = fundStartDay(body);
  if (!startDay.ok) return { error: startDay.error };
  if (startDay.value !== undefined) out.startDay = startDay.value;

  const endDay = fundEndDay(body);
  if (!endDay.ok) return { error: endDay.error };
  if (endDay.value !== undefined) out.endDay = endDay.value;

  if (out.startDay && out.endDay && out.endDay < out.startDay)
    return { error: "endDay can't be before startDay" };

  const goal = await fundGoal(body, spaceId);
  if (!goal.ok) return { error: goal.error };
  if (goal.value !== undefined) out.goalId = goal.value;

  return { fields: out };
}

type ExpenseFieldResult<T> = { ok: true; value?: T } | { ok: false; error: string };

function validateExpenseTitle(body: Record<string, unknown>, required: boolean): ExpenseFieldResult<string> {
  if (!(required || "title" in body)) return { ok: true };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 80) return { ok: false, error: "Say what it was (up to 80 characters)" };
  return { ok: true, value: title };
}

function validateExpenseCents(body: Record<string, unknown>, required: boolean): ExpenseFieldResult<number> {
  if (!(required || "cents" in body)) return { ok: true };
  if (!isCents(body.cents)) return { ok: false, error: "cents must be a whole number above 0" };
  return { ok: true, value: body.cents };
}

function validateExpenseDay(body: Record<string, unknown>, required: boolean): ExpenseFieldResult<string> {
  if (!(required || "day" in body)) return { ok: true };
  if (!isDay(body.day)) return { ok: false, error: "day must be a date like 2026-11-04" };
  return { ok: true, value: body.day };
}

function validateExpenseCategory(body: Record<string, unknown>): ExpenseFieldResult<string> {
  if (!("category" in body)) return { ok: true };
  if (!isCategory(body.category)) return { ok: false, error: `category must be one of ${CATEGORIES.join(", ")}` };
  return { ok: true, value: body.category };
}

async function validateExpensePaidBy(
  body: Record<string, unknown>,
  spaceId: string,
  required: boolean,
): Promise<ExpenseFieldResult<string>> {
  if (!(required || "paidBy" in body)) return { ok: true };
  if (typeof body.paidBy !== "string" || !(await isMember(spaceId, body.paidBy)))
    return { ok: false, error: "paidBy must be someone in your space" };
  return { ok: true, value: body.paidBy };
}

async function validateExpenseSplit(
  body: Record<string, unknown>,
  spaceId: string,
  required: boolean,
): Promise<ExpenseFieldResult<{ split: string; ownerShare: number }>> {
  if (!(required || "split" in body)) return { ok: true };
  const split = body.split ?? "equal";
  if (!isSplit(split)) return { ok: false, error: `split must be one of ${SPLITS.join(", ")}` };
  return { ok: true, value: { split, ownerShare: await ownerShareFor(split, spaceId) } };
}

// Expense fields from a body -> columns, or the first error. `required` for POST.
async function expenseFields(body: Record<string, unknown>, spaceId: string, required: boolean) {
  const out: Partial<typeof expenses.$inferInsert> = {};

  const title = validateExpenseTitle(body, required);
  if (!title.ok) return { error: title.error };
  if (title.value !== undefined) out.title = title.value;

  const cents = validateExpenseCents(body, required);
  if (!cents.ok) return { error: cents.error };
  if (cents.value !== undefined) out.cents = cents.value;

  const day = validateExpenseDay(body, required);
  if (!day.ok) return { error: day.error };
  if (day.value !== undefined) out.day = day.value;

  const category = validateExpenseCategory(body);
  if (!category.ok) return { error: category.error };
  if (category.value !== undefined) out.category = category.value;

  const paidBy = await validateExpensePaidBy(body, spaceId, required);
  if (!paidBy.ok) return { error: paidBy.error };
  if (paidBy.value !== undefined) out.paidBy = paidBy.value;

  const split = await validateExpenseSplit(body, spaceId, required);
  if (!split.ok) return { error: split.error };
  if (split.value !== undefined) {
    out.split = split.value.split;
    out.ownerShare = split.value.ownerShare;
  }

  return { fields: out };
}

type PostBody = Record<string, unknown>;

async function postFund(body: PostBody, spaceId: string) {
  const parsed = await fundFields(body, spaceId, true);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const [fund] = await db
    .insert(funds)
    .values({ spaceId, name: parsed.fields.name!, targetCents: parsed.fields.targetCents!, ...parsed.fields })
    .returning();
  return json({ fund: toFund(fund) }, 201);
}

async function postContribution(body: PostBody, spaceId: string, userId: string) {
  if (!isCents(body.cents, true)) return json({ error: "cents must be a whole number, not 0" }, 400);
  const who = body.userId ?? userId;
  if (typeof who !== "string" || !(await isMember(spaceId, who)))
    return json({ error: "userId must be someone in your space" }, 400);
  if (typeof body.fundId !== "string" || !body.fundId)
    return json({ error: "fundId must be a string" }, 400);
  const [fund] = await db
    .select()
    .from(funds)
    .where(and(eq(funds.id, body.fundId), eq(funds.spaceId, spaceId)));
  if (!fund) return json({ error: "Fund not found" }, 404);
  const [contribution] = await db
    .insert(contributions)
    .values({ spaceId, fundId: fund.id, userId: who, cents: body.cents })
    .returning();
  if (contribution.cents > 0)
    await logActivity({ spaceId, actorUserId: userId, kind: "savings_added", title: `${euros(contribution.cents)} to ${fund.name}`, goalId: fund.goalId });
  return json({ contribution: toContribution(contribution) }, 201);
}

async function postExpense(body: PostBody, spaceId: string, userId: string) {
  const parsed = await expenseFields(body, spaceId, true);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const fields = parsed.fields;
  const [expense] = await db
    .insert(expenses)
    .values({ ...fields, spaceId, title: fields.title!, cents: fields.cents!, day: fields.day!, paidBy: fields.paidBy!, createdBy: userId })
    .returning();
  await logActivity({ spaceId, actorUserId: userId, kind: "expense_added", title: `${expense.title} (${euros(expense.cents)})` });
  return json({ expense: toExpense(expense) }, 201);
}

async function postSettlement(body: PostBody, spaceId: string, userId: string) {
  if (!isCents(body.cents)) return json({ error: "cents must be a whole number above 0" }, 400);
  const fromUserId = body.fromUserId;
  const toUserId = body.toUserId;
  if (
    typeof fromUserId !== "string" ||
    typeof toUserId !== "string" ||
    fromUserId === toUserId ||
    !(await isMember(spaceId, fromUserId)) ||
    !(await isMember(spaceId, toUserId))
  ) return json({ error: "fromUserId and toUserId must be the two of you" }, 400);
  // Optional `at`: when Undo puts back a removed settle-up, it keeps its original date.
  if (body.at !== undefined && typeof body.at !== "string")
    return json({ error: "at must be a past date (ISO)" }, 400);
  const at = body.at === undefined ? undefined : new Date(body.at);
  if (at && (Number.isNaN(at.getTime()) || at > new Date()))
    return json({ error: "at must be a past date (ISO)" }, 400);
  const [settlement] = await db
    .insert(settlements)
    .values({ spaceId, fromUserId, toUserId, cents: body.cents, ...(at ? { createdAt: at } : {}) })
    .returning();
  await logActivity({ spaceId, actorUserId: userId, kind: "settled", title: euros(settlement.cents) });
  return json({ settlement: toSettlement(settlement) }, 201);
}

export async function POST(req: Request) {
  const { me, userId, error } = await auth(req);
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Send { type, ... }" }, 400);

  switch (body.type) {
    case "fund": return postFund(body, me.spaceId);
    case "contribution": return postContribution(body, me.spaceId, userId);
    case "expense": return postExpense(body, me.spaceId, userId);
    case "settlement": return postSettlement(body, me.spaceId, userId);
    default: return json({ error: "type must be fund, contribution, expense or settlement" }, 400);
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
    await Promise.all(
      entries.map(([category, cents]) =>
        db
          .insert(budgets)
          .values({ spaceId: me.spaceId, category, cents: cents as number })
          .onConflictDoUpdate({ target: [budgets.spaceId, budgets.category], set: { cents: cents as number } }),
      ),
    );
  }
  return json({ ok: true });
}

async function patchItem(body: Record<string, unknown>, spaceId: string, kind: "fund" | "expense") {
  if (typeof body.id !== "string") return json({ error: "Send { type, id, ... }" }, 400);
  const parsed = kind === "fund" ? await fundFields(body, spaceId, false) : await expenseFields(body, spaceId, false);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const table = kind === "fund" ? funds : expenses;
  const mine = and(eq(table.id, body.id), eq(table.spaceId, spaceId));
  const rows = Object.keys(parsed.fields).length
    ? await db.update(table).set(parsed.fields).where(mine).returning()
    : await db.select().from(table).where(mine);
  const row = rows[0];

  if (!row) return json({ error: kind === "fund" ? "Fund not found" : "Expense not found" }, 404);
  if (kind === "fund") return json({ fund: toFund(row as typeof funds.$inferSelect) });
  return json({ expense: toExpense(row as typeof expenses.$inferSelect) });
}

export async function PATCH(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Send { type, ... }" }, 400);

  if (body.type === "settings") return saveSettings(body, me);
  if (typeof body.id !== "string") return json({ error: "Send { type, id, ... }" }, 400);

  if (body.type === "fund") return patchItem(body, me.spaceId, "fund");
  if (body.type === "expense") return patchItem(body, me.spaceId, "expense");

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
