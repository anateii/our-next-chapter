import { Plane, House, Briefcase, PiggyBank, Sparkles } from "lucide-react";
import type { Goal, GoalCategory, GoalStatus, Task } from "./types";
import { byDue } from "./helpers/tasks";

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
