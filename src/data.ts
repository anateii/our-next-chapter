import type {
  Milestone,
  Plan,
  MoneyGoal,
  Decision,
  Goal,
} from "./types";
import thailand from "./assets/thailand.png";

export const focus = "A home together. A job that fits. Thailand in 2027.";

export const milestones: Milestone[] = [
  { id: "m1", title: "Driving licence", icon: "car", status: "Up next" },
  { id: "m2", title: "New job", icon: "job", status: "In progress" },
  { id: "m3", title: "Move in together", icon: "home", status: "Planning" },
  { id: "m4", title: "Ana → Thailand", icon: "plane", status: "2027" },
  { id: "m5", title: "Oliver joins", icon: "people", status: "Date to decide" },
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

// Sample data below until goals, steps and the calendar are stored in the database.
export const initialLifeGoals: Goal[] = [
  {
    id: "lg1",
    title: "Thailand adventure",
    subtitle: "Ana moves in 2027 · Oliver joins after",
    category: "Travel",
    stepsDone: 7,
    stepsTotal: 20,
    nextStep: "Research visa requirements",
    owner: "Both",
    image: thailand,
    targetDate: "2027-03-01",
    featured: true,
  },
  {
    id: "lg2",
    title: "Move in together",
    category: "Home",
    stepsDone: 5,
    stepsTotal: 12,
    nextStep: "Shortlist places to rent",
    owner: "Both",
  },
  {
    id: "lg3",
    title: "Grow our careers",
    category: "Career",
    stepsDone: 3,
    stepsTotal: 8,
    nextStep: "Apply for suitable remote roles",
    owner: "owner",
  },
  {
    id: "lg4",
    title: "Build our savings",
    category: "Finance",
    stepsDone: 6,
    stepsTotal: 10,
    nextStep: "Agree our apartment budget",
    owner: "Both",
  },
  {
    id: "lg5",
    title: "Driving licence",
    category: "Life",
    stepsDone: 0,
    stepsTotal: 6,
    nextStep: "Book the theory test",
    owner: "Both",
  },
  {
    id: "lg6",
    title: "Oliver joins in Thailand",
    category: "Travel",
    stepsDone: 0,
    stepsTotal: 5,
    nextStep: "Discuss Oliver's joining window",
    owner: "partner",
  },
];
