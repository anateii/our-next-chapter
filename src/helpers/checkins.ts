// When you check in. One place for the dates, so the Calendar, Home's week
// and Our Space always agree. Keep in step with api/space.ts.

export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type CheckInEvery = "weekly" | "biweekly" | "monthly";
export const frequencies: { key: CheckInEvery; label: string; hint: string; recommended?: boolean }[] = [
  { key: "weekly", label: "Once a week", hint: "Short and easy to keep up", recommended: true },
  { key: "biweekly", label: "Every two weeks", hint: "A bit more to talk about each time" },
  { key: "monthly", label: "Once a month", hint: "On the first one of each month" },
];

export interface CheckInSchedule {
  day: string; // "Sunday"
  every: CheckInEvery;
  since: Date; // when the space started: every-other-week counts from that week
}

export const defaultSchedule = (): CheckInSchedule => ({ day: "Sunday", every: "weekly", since: new Date() });

export const toEvery = (v: unknown): CheckInEvery =>
  v === "biweekly" || v === "monthly" ? v : "weekly";

const DAY_MS = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// JS getDay() (Sunday = 0) for a weekday name; -1 if it isn't one.
const dayIndex = (day: string) => {
  const i = weekdays.indexOf(day);
  return i < 0 ? -1 : (i + 1) % 7;
};
const mondayOf = (d: Date) => {
  const m = midnight(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};

// Every check-in day (local midnight) in [from, to].
export function checkInDates(s: CheckInSchedule, from: Date, to: Date): Date[] {
  const target = dayIndex(s.day);
  if (target < 0) return [];
  const out: Date[] = [];
  const d = midnight(from);

  if (s.every === "monthly") {
    // The first such weekday of each month, from `from`'s month on.
    for (let m = new Date(d.getFullYear(), d.getMonth(), 1); m <= to; m.setMonth(m.getMonth() + 1)) {
      const first = new Date(m.getFullYear(), m.getMonth(), 1 + ((target - m.getDay() + 7) % 7));
      if (first >= d && first <= to) out.push(first);
    }
    return out;
  }

  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
  if (s.every === "biweekly") {
    // On weeks an even number of weeks after the week the space started.
    const weeks = Math.round((mondayOf(d).getTime() - mondayOf(s.since).getTime()) / (7 * DAY_MS));
    if (Math.abs(weeks) % 2 === 1) d.setDate(d.getDate() + 7);
  }
  const step = s.every === "biweekly" ? 14 : 7;
  for (; d <= to; d.setDate(d.getDate() + step)) out.push(new Date(d));
  return out;
}

// "Every Sunday", "Every other Sunday", "First Sunday of the month"
export const scheduleLabel = (s: CheckInSchedule) => {
  if (s.every === "monthly") return `First ${s.day} of the month`;
  if (s.every === "biweekly") return `Every other ${s.day}`;
  return `Every ${s.day}`;
};

// "Weekly check-in", or just "Check-in" when it isn't weekly.
export const checkInTitle = (s: CheckInSchedule) => (s.every === "weekly" ? "Weekly check-in" : "Check-in");

// The next check-in day from today (today counts), and whether the current
// one is already done: a check-in saved after the previous check-in day.
export function nextCheckIn(s: CheckInSchedule, doneAt: readonly string[]) {
  const today = midnight(new Date());
  const dates = checkInDates(s, new Date(today.getTime() - 70 * DAY_MS), new Date(today.getTime() + 100 * DAY_MS));
  const i = dates.findIndex((d) => d >= today);
  if (i < 0) return null;
  const windowStart = i > 0 ? new Date(dates[i - 1].getTime() + DAY_MS) : new Date(0);
  const done = doneAt.some((at) => new Date(at) >= windowStart);
  const day = done ? dates[i + 1] : dates[i];
  if (!day) return null;
  return { day, inDays: Math.round((day.getTime() - today.getTime()) / DAY_MS), done };
}
