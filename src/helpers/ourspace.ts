import { toPerson, type ApiMember } from "./goals";
import type { Partner } from "./finances";

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
  wins: { id: string; text: string; userId: string | null; cheers: string[]; at: string }[];
  checkins: { id: string; answers: CheckInAnswers; at: string }[];
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
  wins: Win[];
  checkins: CheckIn[];
}

export const emptyOurSpace: OurSpace = { wins: [], checkins: [] };

// Clerk user ids -> "owner" | "partner" (anyone no longer in the space drops out).
const partnersOf = (ids: readonly string[], members: readonly ApiMember[]) =>
  ids.map((id) => toPerson(id, members)).filter((p): p is Partner => p !== "Both");

export const fromApiOurSpace = (s: ApiOurSpace, members: readonly ApiMember[]): OurSpace => ({
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
