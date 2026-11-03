import type { Goal, GoalCategory, Person } from "../types";

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

// Clerk user id -> "Ana" | "Oliver" | "Both"
export const toPerson = (
  userId: string | null,
  members: readonly ApiMember[],
): Person => {
  if (!userId) return "Both";
  const name = members.find((m) => m.userId === userId)?.displayName;
  return name === "Ana" || name === "Oliver" ? name : "Both";
};

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
  ownerUserId:
    g.owner === "Both"
      ? null
      : (members.find((m) => m.displayName === g.owner)?.userId ?? null),
  nextStep: g.nextStep,
  targetDate: g.targetDate,
});
