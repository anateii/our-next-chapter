export type Person = "Ana" | "Oliver" | "Both";
export type Status =
  | "Up next"
  | "In progress"
  | "Planning"
  | "To do"
  | "To discuss"
  | "Done"
  | string;

export interface Milestone {
  id: string;
  title: string;
  icon: "car" | "job" | "home" | "plane" | "people";
  status: Status;
}
export type TaskStatus = "To do" | "In progress" | "Done";
export interface Task {
  id: string;
  title: string;
  owner: Person;
  status: TaskStatus;
  done: boolean;
  time?: string; // "6:00 PM" or "Any time", for Home's Today list
  dueAt?: string; // ISO; local midnight = a day without a time
  goalId?: string;
  notes?: string;
  createdBy?: string; // "you" or the partner's name
  createdAt: string; // ISO
  doneAt?: string; // ISO
}
export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  kind: "home" | "food" | "checkin" | "other";
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
export interface Plan {
  id: string;
  label: string;
  icon: "home" | "plane";
  steps: string[];
}
export interface MoneyGoal {
  id: string;
  name: string;
  saved: number;
  target?: number;
}
export interface Decision {
  id: string;
  question: string;
  icon: "pin" | "calendar";
}
export interface Win {
  id: string;
  text: string;
  date: string;
}
