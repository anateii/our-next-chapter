import type { Person, Task, TaskStatus } from "../types";
import { toPerson, toUserId, type ApiMember } from "./goals";

// What /api/tasks returns per task (see toClient() in api/tasks.ts).
export interface ApiTask {
  id: string;
  title: string;
  ownerUserId: string | null; // null = both of you
  status: string;
  done: boolean;
  dueAt: string | null; // ISO
  goalId: string | null;
  notes: string | null;
  createdBy: string | null; // Clerk user id
  createdAt: string;
  doneAt: string | null;
}

// What can change on a task (the details panel, menus, the board).
export interface TaskEdits {
  title?: string;
  owner?: Person;
  status?: TaskStatus;
  dueAt?: string | null;
  goalId?: string | null;
  notes?: string | null;
}

export const taskStatuses: TaskStatus[] = ["To do", "In progress", "Done"];

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Tasks with a day but no time are stored at local midnight (see TaskDialog).
export const hasTime = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
};

// Home's Today list shows "6:00 PM", or "Any time" for a day without a time.
const taskTime = (iso?: string | null) => {
  if (!iso) return undefined;
  return hasTime(iso) ? fmtTime(new Date(iso)) : "Any time";
};

// Local "YYYY-MM-DD", n days from today.
export const localDay = (n = 0, from = new Date()) => {
  const d = startOfDay(from);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ISO due date <-> the day and time inputs ("YYYY-MM-DD", "HH:MM" or "").
export const splitDue = (iso?: string) => {
  if (!iso) return { day: "", time: "" };
  const d = new Date(iso);
  return {
    day: localDay(0, d),
    time: hasTime(iso) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "",
  };
};
export const joinDue = (day: string, time: string): string | null => {
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time ? time.split(":").map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm).toISOString();
};

// Whole days from today to the due day: -1 yesterday, 0 today, 1 tomorrow.
// Round, not floor: DST days are 23 or 25 hours long.
export const daysFromToday = (iso: string, now = new Date()) =>
  Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY_MS);

// Days until Saturday (0 on Saturday itself), for "This weekend".
export const daysToWeekend = (now = new Date()) => (6 - now.getDay() + 7) % 7;

export type TaskGroup = "overdue" | "today" | "tomorrow" | "week" | "later" | "someday" | "done";

export const groupLabels: Record<TaskGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
  later: "Later",
  someday: "Someday",
  done: "Done",
};

export const taskGroup = (t: Task): TaskGroup => {
  if (t.done) return "done";
  if (!t.dueAt) return "someday";
  const d = daysFromToday(t.dueAt);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return d <= 7 ? "week" : "later";
};

// "Today · 6:00 PM", "Overdue · yesterday", "Thu", "12 Nov"
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const shortDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
export const dueLabel = (t: Task): { text: string; tone: "overdue" | "today" | "plain" } | null => {
  if (!t.dueAt) return null;
  const date = new Date(t.dueAt);
  const d = daysFromToday(t.dueAt);
  const time = hasTime(t.dueAt) ? ` · ${fmtTime(date)}` : "";
  if (t.done) return { text: d === 0 ? "Today" : shortDate.format(date), tone: "plain" };
  if (d < 0)
    return { text: `Overdue · ${d === -1 ? "yesterday" : shortDate.format(date)}`, tone: "overdue" };
  if (d === 0) return { text: `Today${time}`, tone: "today" };
  if (d === 1) return { text: `Tomorrow${time}`, tone: "plain" };
  return { text: `${d <= 7 ? weekday.format(date) : shortDate.format(date)}${time}`, tone: "plain" };
};

// Sort by due day and time, undated last.
export const byDue = (a: Task, b: Task) =>
  (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");

// Most recently finished first.
export const byDoneAt = (a: Task, b: Task) =>
  (b.doneAt ?? "").localeCompare(a.doneAt ?? "");

// Older tasks may hold other status text; anything unknown reads as "To do".
const toStatus = (t: ApiTask): TaskStatus => {
  if (t.done) return "Done";
  return t.status === "In progress" ? "In progress" : "To do";
};

export const fromApiTask = (
  t: ApiTask,
  members: readonly ApiMember[],
  myUserId?: string | null,
): Task => {
  const creator = members.find((m) => m.userId === t.createdBy)?.displayName;
  return {
    id: t.id,
    title: t.title,
    owner: toPerson(t.ownerUserId, members),
    status: toStatus(t),
    done: t.done,
    time: taskTime(t.dueAt),
    dueAt: t.dueAt ?? undefined,
    goalId: t.goalId ?? undefined,
    notes: t.notes ?? undefined,
    createdBy: t.createdBy && t.createdBy === myUserId ? "you" : (creator ?? undefined),
    createdAt: t.createdAt,
    doneAt: t.doneAt ?? undefined,
  };
};

// The same edits applied locally, so the UI updates before the save finishes.
export const applyEdits = (t: Task, e: TaskEdits): Task => {
  const next: Task = { ...t };
  if (e.title !== undefined) next.title = e.title;
  if (e.owner !== undefined) next.owner = e.owner;
  if (e.notes !== undefined) next.notes = e.notes ?? undefined;
  if (e.goalId !== undefined) next.goalId = e.goalId ?? undefined;
  if (e.dueAt !== undefined) {
    next.dueAt = e.dueAt ?? undefined;
    next.time = taskTime(e.dueAt);
  }
  if (e.status !== undefined) {
    next.status = e.status;
    next.done = e.status === "Done";
    if (next.done !== t.done) next.doneAt = next.done ? new Date().toISOString() : undefined;
  }
  return next;
};

// TaskEdits -> PATCH /api/tasks body fields.
export const toApiEdits = (e: TaskEdits, members: readonly ApiMember[]) => {
  const { owner, ...rest } = e;
  return owner === undefined ? rest : { ...rest, ownerUserId: toUserId(owner, members) };
};

// "today", "yesterday", "3 days ago"
export const addedAgo = (iso: string) => {
  const d = -daysFromToday(iso);
  if (d <= 0) return "today";
  return d === 1 ? "yesterday" : `${d} days ago`;
};
