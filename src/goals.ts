import { Plane, House, Briefcase, PiggyBank, Sparkles } from "lucide-react";
import type { Goal, GoalCategory, GoalStatus } from "./types";

export const categoryIcons: Record<GoalCategory, typeof Plane> = {
  Travel: Plane,
  Home: House,
  Career: Briefcase,
  Finance: PiggyBank,
  Life: Sparkles,
};

export const goalStatus = (g: Goal): GoalStatus => {
  if (g.stepsTotal > 0 && g.stepsDone >= g.stepsTotal) return "Completed";
  return g.stepsDone > 0 ? "In progress" : "Not started";
};

export const goalProgress = (g: Goal) =>
  g.stepsTotal ? Math.round((g.stepsDone / g.stepsTotal) * 100) : 0;

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
