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
