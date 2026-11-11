import { Plane, House, Briefcase, PiggyBank, Sparkles } from "lucide-react";
import type { Goal, GoalCategory, GoalStatus, Person, Task } from "../types";
import { byDue } from "./tasks";

// What GET /api/goals returns per goal (see toClient() in api/goals.ts).
export interface ApiGoal {
  id: string;
  title: string;
  subtitle: string | null;
  category: "travel" | "home" | "career" | "finance" | "life";
  ownerUserId: string | null; // null = both of you
  stepsDone: number;
  stepsTotal: number;
  nextStep: string | null;
  image: string | null;
  targetDate: string | null; // "YYYY-MM-DD"
  savedCents: number;
  targetCents: number | null;
  featured: boolean;
}

// What GET /api/home returns in `members`.
export interface ApiMember {
  userId: string;
  displayName: string | null;
  role: "owner" | "partner";
}

// "travel" -> "Travel"
const toCategory = (c: ApiGoal["category"]) =>
  (c[0].toUpperCase() + c.slice(1)) as GoalCategory;

// Clerk user id -> "owner" | "partner" (null, or someone not in the space: "Both")
export const toPerson = (
  userId: string | null,
  members: readonly ApiMember[],
): Person => members.find((m) => m.userId === userId)?.role ?? "Both";

// "owner" | "partner" | "Both" -> Clerk user id (null = both of you)
export const toUserId = (person: Person, members: readonly ApiMember[]) =>
  person === "Both"
    ? null
    : (members.find((m) => m.role === person)?.userId ?? null);

// API goal -> the Goal type the UI already uses.
// null becomes undefined because the UI's optional fields are `field?: string`.
export const fromApiGoal = (
  g: ApiGoal,
  members: readonly ApiMember[],
): Goal => ({
  id: g.id,
  title: g.title,
  subtitle: g.subtitle ?? undefined,
  category: toCategory(g.category),
  owner: toPerson(g.ownerUserId, members),
  stepsDone: g.stepsDone,
  stepsTotal: g.stepsTotal,
  nextStep: g.nextStep ?? undefined,
  image: g.image ?? undefined,
  targetDate: g.targetDate ?? undefined,
  featured: g.featured,
});

// The reverse, for POST /api/goals when the New goal dialog submits.
export const toApiNewGoal = (
  g: Omit<Goal, "id">,
  members: readonly ApiMember[],
) => ({
  title: g.title,
  category: g.category.toLowerCase(),
  ownerUserId: toUserId(g.owner, members),
  nextStep: g.nextStep,
  targetDate: g.targetDate,
  imageUrl: g.image,
});

/* Goal logic: categories, steps, status and progress, dates */
export const categoryIcons: Record<GoalCategory, typeof Plane> = {
  Travel: Plane,
  Home: House,
  Career: Briefcase,
  Finance: PiggyBank,
  Life: Sparkles,
};

// A goal's steps are the tasks linked to it.
export interface GoalSteps {
  total: number;
  done: number;
  started: boolean; // a step is in progress or done
  open: Task[]; // steps not done yet, soonest first
  recentDone: Task[]; // steps done within the loaded window
}

// Steps per goal id: the loaded tasks, plus `olderDone` (linked tasks finished
// before the loaded window, which only come as counts).
export const goalSteps = (
  tasks: readonly Task[],
  olderDone: Readonly<Record<string, number>>,
): ReadonlyMap<string, GoalSteps> => {
  const steps = new Map<string, GoalSteps>();
  const get = (id: string) => {
    let s = steps.get(id);
    if (!s) {
      s = { total: 0, done: 0, started: false, open: [], recentDone: [] };
      steps.set(id, s);
    }
    return s;
  };
  for (const [id, n] of Object.entries(olderDone)) {
    const s = get(id);
    s.total += n;
    s.done += n;
    s.started = true;
  }
  for (const t of [...tasks].sort(byDue)) {
    if (!t.goalId) continue;
    const s = get(t.goalId);
    s.total += 1;
    if (t.done) {
      s.done += 1;
      s.recentDone.push(t);
    } else s.open.push(t);
    if (t.status !== "To do") s.started = true;
  }
  return steps;
};

// Goals with steps go by them. Older goals without any keep their stored
// step counts (a goal marked complete with none counts as 1 of 1).
export const goalStatus = (g: Goal, s?: GoalSteps): GoalStatus => {
  if (s?.total) {
    if (s.done === s.total) return "Completed";
    return s.started ? "In progress" : "Not started";
  }
  if (g.stepsTotal > 0 && g.stepsDone >= g.stepsTotal) return "Completed";
  return g.stepsDone > 0 ? "In progress" : "Not started";
};

// Rounded down, so it only shows 100% once everything is done.
export const goalProgress = (g: Goal, s?: GoalSteps) => {
  const [done, total] = s?.total ? [s.done, s.total] : [g.stepsDone, g.stepsTotal];
  return total ? Math.floor((done / total) * 100) : 0;
};

// "YYYY-MM-DD" as local midnight, so the countdown flips at the user's midnight.
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const daysUntil = (iso: string, now = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Round, not floor: DST days are 23 or 25 hours long.
  return Math.round((parseDay(iso).getTime() - today.getTime()) / 86_400_000);
};
