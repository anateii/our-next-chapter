import type { Milestone, Task, Plan, MoneyGoal, Decision } from "./types";

export const focus = "A home together. A job that fits. Thailand in 2027.";

export const milestones: Milestone[] = [
  { id: "m1", title: "Driving licence", icon: "car", status: "Up next" },
  { id: "m2", title: "New job", icon: "job", status: "In progress" },
  { id: "m3", title: "Move in together", icon: "home", status: "Planning" },
  { id: "m4", title: "Ana → Thailand", icon: "plane", status: "2027" },
  { id: "m5", title: "Oliver joins", icon: "people", status: "Date to decide" },
];

export const initialTasks: Task[] = [
  {
    id: "t1",
    title: "Agree our apartment budget",
    owner: "Both",
    status: "To do",
    done: false,
  },
  {
    id: "t2",
    title: "Shortlist places to rent",
    owner: "Both",
    status: "To do",
    done: false,
  },
  {
    id: "t3",
    title: "Apply for suitable remote roles",
    owner: "Ana",
    status: "In progress",
    done: false,
  },
  {
    id: "t4",
    title: "Discuss Oliver's joining window",
    owner: "Oliver",
    status: "To discuss",
    done: false,
  },
];

export const plans: Plan[] = [
  {
    id: "A",
    label: "Plan A",
    icon: "home",
    steps: ["Rent together", "Ana moves", "Oliver joins"],
  },
  {
    id: "B",
    label: "Plan B",
    icon: "plane",
    steps: ["Temporary housing", "Adjust travel dates"],
  },
];

export const initialGoals: MoneyGoal[] = [
  { id: "g1", name: "Apartment fund", saved: 0 },
  { id: "g2", name: "Thailand move", saved: 0 },
  { id: "g3", name: "Emergency buffer", saved: 0 },
];

export const decisions: Decision[] = [
  { id: "d1", question: "Where should we rent?", icon: "pin" },
  { id: "d2", question: "When could Oliver join?", icon: "calendar" },
];
