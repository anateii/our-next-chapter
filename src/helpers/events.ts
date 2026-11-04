import { checkInDates, checkInTitle, type CheckInSchedule } from "./checkins";
import {
  Briefcase,
  CalendarDays,
  Heart,
  MessageCircle,
  Plane,
  Stethoscope,
  Users,
} from "lucide-react";
import type { CalendarEvent, EventKind, Person } from "../types";
import { toPerson, toUserId, type ApiMember } from "./goals";

// What /api/events returns per event (see toClient() in api/events.ts).
export interface ApiEvent {
  id: string;
  title: string;
  kind: EventKind;
  startsAt: string; // ISO
  allDay: boolean;
  ownerUserId: string | null; // null = both of you
  notes: string | null;
}

// What can change on an event. startsAt and allDay go together.
export interface EventEdits {
  title?: string;
  startsAt?: string; // ISO
  allDay?: boolean;
  kind?: EventKind;
  owner?: Person;
  notes?: string | null;
}

// The kinds you can pick for an event, in the order the dropdown lists them.
export const eventKinds: { kind: EventKind; label: string }[] = [
  { kind: "appointment", label: "Appointment" },
  { kind: "work", label: "Work" },
  { kind: "travel", label: "Travel" },
  { kind: "date", label: "Date" },
  { kind: "family", label: "Family" },
  { kind: "other", label: "Other" },
];

export const kindLabel = (kind: EventKind) =>
  kind === "checkin" ? "Check-in" : eventKinds.find((k) => k.kind === kind)?.label;

export const kindIcons: Record<EventKind, typeof Stethoscope> = {
  appointment: Stethoscope,
  work: Briefcase,
  travel: Plane,
  date: Heart,
  family: Users,
  other: CalendarDays,
  checkin: MessageCircle,
};

const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// Recompute the display fields from startsAt/allDay.
const withDisplay = (e: Omit<CalendarEvent, "date" | "time">): CalendarEvent => {
  const date = new Date(e.startsAt);
  return { ...e, date, time: e.allDay ? "" : fmtTime(date) };
};

export const fromApiEvent = (e: ApiEvent, members: readonly ApiMember[]): CalendarEvent =>
  withDisplay({
    id: e.id,
    title: e.title,
    kind: e.kind,
    startsAt: e.startsAt,
    allDay: e.allDay,
    owner: toPerson(e.ownerUserId, members),
    notes: e.notes ?? undefined,
  });

export const applyEventEdits = (e: CalendarEvent, edits: EventEdits): CalendarEvent =>
  withDisplay({
    ...e,
    ...edits,
    notes: edits.notes === undefined ? e.notes : (edits.notes ?? undefined),
  });

// owner -> ownerUserId for the API
export const toApiEventEdits = (edits: EventEdits, members: readonly ApiMember[]) => {
  const { owner, ...rest } = edits;
  return owner === undefined ? rest : { ...rest, ownerUserId: toUserId(owner, members) };
};

// "YYYY-MM-DD" + "HH:MM" (or "" for all day) -> { startsAt, allDay }
export const eventStart = (day: string, time: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time ? time.split(":").map(Number) : [0, 0];
  return { startsAt: new Date(y, m - 1, d, h, min).toISOString(), allDay: !time };
};

// Same time of day, on another day ("YYYY-MM-DD").
export const moveToDay = (e: CalendarEvent, day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(e.date);
  next.setFullYear(y, m - 1, d);
  return next.toISOString();
};

// The check-ins for each scheduled day in [from, to] (see helpers/checkins.ts).
export const checkIns = (schedule: CheckInSchedule, from: Date, to: Date): CalendarEvent[] =>
  checkInDates(schedule, from, to).map((d) => {
    const startsAt = d.toISOString();
    return withDisplay({
      id: `checkin-${startsAt}`,
      title: checkInTitle(schedule),
      kind: "checkin",
      startsAt,
      allDay: true,
      owner: "Both",
      recurring: true,
    });
  });
