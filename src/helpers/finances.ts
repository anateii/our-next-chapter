import {
  Bus,
  HeartPulse,
  House,
  Plane,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Zap,
} from "lucide-react";
import type { Person } from "../types";
import { toPerson, type ApiMember } from "./goals";

// One of the two of you (finances never belong to "both").
export type Partner = Exclude<Person, "Both">;

// "home" is Rent (it used to be "Rent & bills", so older entries stay with it).
export const categories = [
  { key: "home", label: "Rent/Housing", icon: House },
  { key: "utilities", label: "Utilities", icon: Zap },
  { key: "subscriptions", label: "Subscriptions", icon: Repeat },
  { key: "transport", label: "Transportation", icon: Bus },
  { key: "health", label: "Health", icon: HeartPulse },
  { key: "food", label: "Groceries", icon: ShoppingCart },
  { key: "out", label: "Eating out", icon: Utensils },
  { key: "travel", label: "Vacations", icon: Plane },
  { key: "other", label: "Other", icon: ShoppingBag },
] as const;
export type Category = (typeof categories)[number]["key"];
export const categoryOf = (key: string) =>
  categories.find((c) => c.key === key) ?? categories.at(-1)!;

export type Split = "equal" | "income" | "owner" | "partner";

// What GET /api/finances returns (see api/finances.ts).
export interface ApiFinances {
  funds: {
    id: string;
    name: string;
    goalId: string | null;
    targetCents: number;
    monthlyCents: number;
    startDay?: string;
    endDay?: string | null;
  }[];
  contributions: { id: string; fundId: string; userId: string; cents: number; at: string }[];
  expenses: {
    id: string;
    title: string;
    cents: number;
    category: string;
    paidBy: string;
    split: Split;
    ownerShare: number;
    day: string;
  }[];
  settlements: { id: string; fromUserId: string; toUserId: string; cents: number; at: string }[];
  budgets: Partial<Record<Category, number>>;
  incomeSplit: number;
}

export interface Fund {
  id: string;
  name: string;
  goalId?: string;
  targetCents: number;
  monthlyCents: number;
  startDay: string; // "YYYY-MM-DD": monthly payments are due from this month
  endDay?: string; // "YYYY-MM-DD": when you mean to reach the target
}
export interface Contribution {
  id: string;
  fundId: string;
  who: Partner;
  cents: number;
  at: string; // ISO
}
export interface Expense {
  id: string;
  title: string;
  cents: number;
  category: Category;
  paidBy: Partner;
  split: Split;
  ownerShare: number; // percent of it that's the owner's
  day: string; // "YYYY-MM-DD"
}
export interface Settlement {
  id: string;
  from: Partner;
  to: Partner;
  cents: number;
  at: string; // ISO
}
export interface Finances {
  funds: Fund[];
  contributions: Contribution[];
  expenses: Expense[];
  settlements: Settlement[];
  budgets: Partial<Record<Category, number>>;
  incomeSplit: number; // owner's percent when splitting by income
}
export const emptyFinances: Finances = {
  funds: [],
  contributions: [],
  expenses: [],
  settlements: [],
  budgets: {},
  incomeSplit: 50,
};

// "Both" can't pay; someone outside the space (shouldn't happen) counts as the owner.
const partnerOf = (userId: string, members: readonly ApiMember[]): Partner => {
  const p = toPerson(userId, members);
  return p === "Both" ? "owner" : p;
};

export const fromApiFinances = (f: ApiFinances, members: readonly ApiMember[]): Finances => ({
  // An API from before timeframes sends no startDay: count the fund as started today.
  funds: f.funds.map((x) => ({
    ...x,
    goalId: x.goalId ?? undefined,
    startDay: x.startDay ?? dayKey(new Date()),
    endDay: x.endDay ?? undefined,
  })),
  contributions: f.contributions.map(({ userId, ...c }) => ({ ...c, who: partnerOf(userId, members) })),
  expenses: f.expenses.map(({ paidBy, category, ...x }) => ({
    ...x,
    category: categoryOf(category).key,
    paidBy: partnerOf(paidBy, members),
  })),
  settlements: f.settlements.map(({ fromUserId, toUserId, ...s }) => ({
    ...s,
    from: partnerOf(fromUserId, members),
    to: partnerOf(toUserId, members),
  })),
  budgets: f.budgets,
  incomeSplit: f.incomeSplit,
});

// The owner's share (percent) for a split, as the API works it out.
export const ownerShareFor = (split: Split, incomeSplit: number) =>
  ({ equal: 50, income: incomeSplit, owner: 100, partner: 0 })[split];

// How much of an expense is each person's.
export const shareOf = (x: Expense, who: Partner) => {
  const owner = Math.round((x.cents * x.ownerShare) / 100);
  return who === "owner" ? owner : x.cents - owner;
};

// What the partner owes the owner, across everything (negative: the owner owes).
export const balance = (f: Finances) => {
  let b = 0;
  for (const x of f.expenses)
    b += x.paidBy === "owner" ? shareOf(x, "partner") : -shareOf(x, "owner");
  for (const s of f.settlements) b += s.from === "partner" ? -s.cents : s.cents;
  return b;
};

export const savedIn = (fundId: string, contributions: readonly Contribution[]) => {
  const by = { owner: 0, partner: 0 };
  for (const c of contributions) if (c.fundId === fundId) by[c.who] += c.cents;
  return by;
};

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" });
const moneyWhole = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
export const formatMoney = (cents: number) => money.format(cents / 100);
// Whole euros when the amount is whole (€1,200), otherwise with cents (€35.70).
// Never rounds: a summary must add up to what was entered.
export const formatWhole = (cents: number) =>
  cents % 100 === 0 ? moneyWhole.format(cents / 100) : money.format(cents / 100);

// "42,50" or "42.50" or "€1,200" -> cents, or null if it isn't an amount above 0.
export const parseCents = (text: string) => {
  const cleaned = text.replace(/[^\d.,]/g, "");
  // A comma followed by 1-2 digits at the end is a decimal comma.
  const normal = /,\d{1,2}$/.test(cleaned)
    ? cleaned.replaceAll(".", "").replace(",", ".")
    : cleaned.replaceAll(",", "");
  const n = Number(normal);
  return normal && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

// "YYYY-MM-DD" for a local date
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Months and progress, shared by the Finances cards */

// "YYYY-MM" of a "YYYY-MM-DD" day, and of a local date.
export const monthOf = (day: string) => day.slice(0, 7);
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthName = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
// "2026-11" -> "November 2026"
export const monthTitle = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return monthName.format(new Date(y, m - 1, 1));
};
// "2026-11" -> "November"
export const monthShort = (month: string) => monthTitle(month).split(" ")[0];
// The "YYYY-MM" `n` months from `month`.
export const shiftMonthKey = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};
// The month's expenses, and their total.
export const expensesIn = (f: Finances, month: string) => f.expenses.filter((x) => monthOf(x.day) === month);
export const totalOf = (xs: readonly { cents: number }[]) => xs.reduce((s, x) => s + x.cents, 0);
export const budgetTotalOf = (f: Finances) => categories.reduce((s, c) => s + (f.budgets[c.key] ?? 0), 0);
// A part of a whole, as a percentage from 0 to 100.
export const pct = (part: number, whole: number) => (whole ? Math.min(100, (part / whole) * 100) : 0);

/* A fund's timeframe and this month's payment */

const monthYear = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
// "2027-03" -> "Mar 2027"
export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return monthYear.format(new Date(y, m - 1, 1));
};
// Months from `a` to `b` ("YYYY-MM"), counting both: 2026-11 to 2027-01 is 3.
export const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am) + 1;
};

// What's been put into a fund in `month` ("YYYY-MM").
export const paidIn = (fundId: string, month: string, contributions: readonly Contribution[]) =>
  contributions
    .filter((c) => c.fundId === fundId && monthKey(new Date(c.at)) === month)
    .reduce((s, c) => s + c.cents, 0);

// The month the target is reached, if you keep to the monthly amount: this
// month's payment (or what's left of it) first, then one a month after that.
// Payments only start in the fund's start month. null without a monthly amount.
export const finishMonth = (left: number, monthly: number, paidThisMonth: number, startDay: string, now = new Date()) => {
  if (left <= 0) return monthKey(now);
  if (!monthly) return null;
  const today = monthKey(now);
  const first = monthOf(startDay) > today ? monthOf(startDay) : today;
  const dueNow = first === today ? Math.max(0, monthly - paidThisMonth) : monthly;
  if (left <= dueNow) return first;
  return shiftMonthKey(first, Math.ceil((left - dueNow) / monthly));
};

// What it takes each month, from this month on, to reach the target by the end day.
export const neededMonthly = (left: number, endDay: string, startDay: string, now = new Date()) => {
  const today = monthKey(now);
  const first = monthOf(startDay) > today ? monthOf(startDay) : today;
  const months = monthsBetween(first, monthOf(endDay));
  return months > 0 ? Math.ceil(left / months / 100) * 100 : left;
};

export type FundStatus =
  | { kind: "done" }
  | { kind: "none" } // no monthly amount, or outside the timeframe
  | { kind: "paid"; month: string }
  | { kind: "missing"; month: string; cents: number }
  // The monthly amount won't reach the target by the end day: `cents` a month would.
  | { kind: "behind"; endDay: string; cents: number };

// Is the fund keeping up? Behind its end day first, then this month's payment.
// Only once the fund has started and before its end day's month is over.
export const fundStatus = (f: Fund, contributions: readonly Contribution[], now = new Date()): FundStatus => {
  const saved = savedIn(f.id, contributions);
  const left = f.targetCents - saved.owner - saved.partner;
  if (left <= 0) return { kind: "done" };
  const month = monthKey(now);
  if (monthOf(f.startDay) > month || (f.endDay !== undefined && monthOf(f.endDay) < month)) return { kind: "none" };
  const paid = paidIn(f.id, month, contributions);
  if (f.endDay !== undefined) {
    const finish = finishMonth(left, f.monthlyCents, paid, f.startDay, now);
    if (finish === null || finish > monthOf(f.endDay))
      return { kind: "behind", endDay: f.endDay, cents: neededMonthly(left, f.endDay, f.startDay, now) };
  }
  if (!f.monthlyCents) return { kind: "none" };
  return paid >= f.monthlyCents
    ? { kind: "paid", month }
    : { kind: "missing", month, cents: f.monthlyCents - paid };
};

// The Fund dialog's live line: when you'll get there, or what it takes to get there in time.
export const planText = (p: {
  left: number;
  monthly: number;
  paidThisMonth: number;
  startDay: string;
  endDay?: string;
}) => {
  if (p.left <= 0) return null;
  const finish = finishMonth(p.left, p.monthly, p.paidThisMonth, p.startDay);
  const at = p.monthly ? `At ${formatWhole(p.monthly)} a month you'll get there in ${monthLabel(finish!)}` : "";
  if (!p.endDay) return at ? `${at}.` : null;
  const need = neededMonthly(p.left, p.endDay, p.startDay);
  const end = monthLabel(monthOf(p.endDay));
  if (at && finish! <= monthOf(p.endDay)) return `${at}, in time for ${end}.`;
  return `To get there by ${end}, put in ${formatWhole(need)} a month.`;
};
