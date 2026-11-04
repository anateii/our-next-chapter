// Who something is for, by place in the space: "owner" started it, "partner"
// joined it. Their names come from usePeople() (helpers/people.ts).
export type Person = "owner" | "partner" | "Both";
export type TaskStatus = "To do" | "In progress" | "Done";
export interface Task {
  id: string;
  title: string;
  owner: Person;
  status: TaskStatus;
  done: boolean;
  time?: string; // "6:00 PM", only when the task has a time
  dueAt?: string; // ISO; local midnight = a day without a time
  goalId?: string;
  notes?: string;
  createdBy?: string; // "you" or the partner's name
  createdAt: string; // ISO
  doneAt?: string; // ISO
}
// "checkin" is only used for the weekly check-in, never picked by hand.
export type EventKind =
  | "appointment"
  | "work"
  | "travel"
  | "date"
  | "family"
  | "other"
  | "checkin";
export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string; // ISO; local midnight when allDay
  date: Date; // startsAt as a Date
  time: string; // "7:30 PM", or "" when allDay
  allDay: boolean;
  kind: EventKind;
  owner: Person; // who's going
  notes?: string;
  recurring?: boolean; // the weekly check-in, shown on the calendar but not stored
}
export interface Adventure {
  title: string;
  subtitle?: string;
  progress: number;
  image?: string;
  targetDate?: string;
}
export type GoalCategory = "Travel" | "Home" | "Career" | "Finance" | "Life";
export type GoalStatus = "In progress" | "Not started" | "Completed";
export interface Goal {
  id: string;
  title: string;
  subtitle?: string;
  category: GoalCategory;
  stepsDone: number;
  stepsTotal: number;
  nextStep?: string;
  owner: Person;
  image?: string;
  targetDate?: string; // "YYYY-MM-DD", drives the countdown on Home
  featured?: boolean; // shown as the "next adventure" card on Home
}
