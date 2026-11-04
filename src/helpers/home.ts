import type { EventKind } from "../types";
import type { ApiMember } from "./goals";

// What GET /api/home returns (see api/home.ts).
export interface ApiHome {
  space: {
    id: string;
    name: string;
    focus: string | null;
    checkInDay: string;
    checkInEvery: string; // "weekly" | "biweekly" | "monthly"
    createdAt: string;
  };
  members: ApiMember[];
  stats: { activeGoals: number; tasksLeft: number; upcomingEvents: number };
  today: {
    id: string;
    title: string;
    ownerUserId: string | null; // null = both of you
    status: string;
    done: boolean;
    dueAt: string | null; // ISO
  }[];
  week: {
    start: string;
    events: {
      id: string;
      title: string;
      kind: EventKind;
      startsAt: string; // ISO
    }[];
  };
}

// "Today" and "this week" depend on the viewer's timezone, so send local midnights.
export const homeQuery = (now = new Date()) => {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7)); // Monday
  return new URLSearchParams({
    dayStart: dayStart.toISOString(),
    weekStart: weekStart.toISOString(),
  }).toString();
};
