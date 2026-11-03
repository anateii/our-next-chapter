import type { CalendarEvent, Task } from "../types";
import { toPerson, type ApiMember } from "./goals";

// What GET /api/home returns (see api/home.ts).
export interface ApiHome {
  space: { id: string; name: string; focus: string | null; checkInDay: string };
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
      kind: CalendarEvent["kind"];
      startsAt: string; // ISO
    }[];
  };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// Tasks with a day but no time are stored at local midnight (see TaskDialog).
const taskTime = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() === 0 && d.getMinutes() === 0 ? "Any time" : fmtTime(iso);
};

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

export const fromApiTask = (t: ApiHome["today"][number], members: readonly ApiMember[]): Task => ({
  id: t.id,
  title: t.title,
  owner: toPerson(t.ownerUserId, members),
  status: t.status,
  done: t.done,
  time: t.dueAt ? taskTime(t.dueAt) : undefined,
});

export const fromApiEvent = (e: ApiHome["week"]["events"][number]): CalendarEvent => ({
  id: e.id,
  title: e.title,
  date: new Date(e.startsAt),
  time: fmtTime(e.startsAt),
  kind: e.kind,
});
