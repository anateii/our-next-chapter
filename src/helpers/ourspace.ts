import { Briefcase, Car, House, Plane, Star, Users, type LucideIcon } from "lucide-react";
import { toPerson, type ApiMember } from "./goals";
import type { Partner } from "./finances";

// Keep in step with api/ourspace.ts.
export const statuses = ["Done", "In progress", "Up next", "Planning", "Date to decide"] as const;
export type MilestoneStatus = (typeof statuses)[number];
// "In progress" -> "in-progress", for the status-* colour classes
export const statusSlug = (s: string) => s.toLowerCase().replaceAll(" ", "-");
export const milestoneIcons: { key: MilestoneIcon; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "job", label: "Work", icon: Briefcase },
  { key: "car", label: "Car", icon: Car },
  { key: "plane", label: "Travel", icon: Plane },
  { key: "people", label: "Together", icon: Users },
  { key: "star", label: "Other", icon: Star },
];
export type MilestoneIcon = "car" | "job" | "home" | "plane" | "people" | "star";
export const iconOf = (key: string) => milestoneIcons.find((i) => i.key === key)?.icon ?? Star;

export const moods = ["Great", "Good", "Okay", "Tough"] as const;
export type Mood = (typeof moods)[number];

export interface CheckInAnswer {
  mood: Mood;
  good: string;
  hard: string;
  next: string;
}
export type CheckInAnswers = Partial<Record<Partner, CheckInAnswer>>;

// What GET /api/ourspace returns.
export interface ApiOurSpace {
  milestones: {
    id: string;
    title: string;
    icon: MilestoneIcon;
    emoji: string | null;
    status: string;
    when: string | null;
  }[];
  wins: { id: string; text: string; userId: string | null; cheers: string[]; at: string }[];
  checkins: { id: string; answers: CheckInAnswers; at: string }[];
}

export interface Milestone {
  id: string;
  title: string;
  icon: MilestoneIcon; // shown when there's no emoji (milestones from before emojis)
  emoji?: string;
  status: MilestoneStatus;
  when?: string;
}
export interface Win {
  id: string;
  text: string;
  who?: Partner;
  cheers: Partner[];
  at: string;
}
export interface CheckIn {
  id: string;
  answers: CheckInAnswers;
  at: string;
}
export interface OurSpace {
  milestones: Milestone[];
  wins: Win[];
  checkins: CheckIn[];
}

export const emptyOurSpace: OurSpace = { milestones: [], wins: [], checkins: [] };

// Clerk user ids -> "owner" | "partner" (anyone no longer in the space drops out).
const partnersOf = (ids: readonly string[], members: readonly ApiMember[]) =>
  ids.map((id) => toPerson(id, members)).filter((p): p is Partner => p !== "Both");

export const fromApiOurSpace = (s: ApiOurSpace, members: readonly ApiMember[]): OurSpace => ({
  milestones: s.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    icon: m.icon,
    emoji: m.emoji ?? undefined,
    status: (statuses as readonly string[]).includes(m.status) ? (m.status as MilestoneStatus) : "Planning",
    when: m.when ?? undefined,
  })),
  wins: s.wins.map((w) => {
    const who = toPerson(w.userId, members);
    return {
      id: w.id,
      text: w.text,
      who: who === "Both" ? undefined : who,
      cheers: partnersOf(w.cheers, members),
      at: w.at,
    };
  }),
  checkins: s.checkins,
});

// Local midnight, `n` days from today.
export const dayFromToday = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

// Whole days from today to a "YYYY-MM-DD" date.
export const daysUntil = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - dayFromToday(0).getTime()) / 86_400_000);
};
