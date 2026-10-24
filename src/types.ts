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
export interface Task {
  id: string;
  title: string;
  owner: Person;
  status: Status;
  done: boolean;
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
