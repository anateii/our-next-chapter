import { useState } from "react";
import {
  CalendarDays,
  Check,
  Handshake,
  Heart,
  Image,
  MessagesSquare,
  PartyPopper,
  PiggyBank,
  Plus,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Goal, Person } from "../types";
import type { ApiActivity } from "../helpers/activity";
import { toPerson, type ApiMember } from "../helpers/goals";
import { usePeople } from "../helpers/people";
import Avatars from "./Avatars";

type Who = "all" | Person;

const kinds: Record<ApiActivity["kind"], { icon: LucideIcon; tone: string }> = {
  task_added: { icon: Plus, tone: "accent" },
  step_added: { icon: Plus, tone: "accent" },
  task_done: { icon: Check, tone: "sage" },
  goal_added: { icon: Heart, tone: "accent" },
  goal_completed: { icon: Trophy, tone: "sage" },
  goal_photo: { icon: Image, tone: "peach" },
  event_added: { icon: CalendarDays, tone: "sky" },
  expense_added: { icon: Wallet, tone: "peach" },
  savings_added: { icon: PiggyBank, tone: "sage" },
  settled: { icon: Handshake, tone: "sage" },
  win_added: { icon: PartyPopper, tone: "peach" },
  checkin_done: { icon: MessagesSquare, tone: "accent" },
};

const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const dayOnly = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

// Whole days between the local day of `iso` and today (0 = today, -1 = yesterday).
const dayOffset = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
};

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (dayOffset(iso) === 0) return `${Math.round(mins / 60)} h ago`;
  return time.format(new Date(iso));
};

const groupOf = (iso: string) => {
  const n = dayOffset(iso);
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return "Earlier this week";
};

// A new task's day: midnight means no time was set.
const whenLabel = (iso: string) => {
  const d = new Date(iso);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return (hasTime ? dayTime : dayOnly).format(d);
};

// The sentence after the person's name, with the subject in bold.
function Sentence({ a, goal }: Readonly<{ a: ApiActivity; goal?: Goal }>) {
  const t = <b>{a.title}</b>;
  switch (a.kind) {
    case "task_added":
      return <>added {t}</>;
    case "step_added":
      return goal ? (
        <>
          added a step to <b>{goal.title}</b>: “{a.title}”
        </>
      ) : (
        <>added the step {t}</>
      );
    case "task_done":
      return <>finished {t}</>;
    case "goal_added":
      return <>created the goal {t}</>;
    case "goal_completed":
      return <>completed the goal {t}</>;
    case "goal_photo":
      return <>added a cover photo to {t}</>;
    case "event_added":
      return <>added {t} to the calendar</>;
    case "expense_added":
      return <>added the expense {t}</>;
    case "savings_added":
      return <>saved {t}</>;
    case "settled":
      return <>settled up ({a.title})</>;
    case "win_added":
      return <>celebrated a win: {t}</>;
    case "checkin_done":
      return <>saved your check-in</>;
  }
}

export default function RecentActivity({
  activity,
  members,
  myUserId,
  goals,
  newSince,
}: Readonly<{
  activity: readonly ApiActivity[];
  members: readonly ApiMember[];
  myUserId: string | null | undefined;
  goals: readonly Goal[];
  newSince: string | null; // when I last opened the feed, before this visit
}>) {
  const [who, setWho] = useState<Who>("all");
  const { name } = usePeople();
  const me = toPerson(myUserId ?? null, members);
  const partner: Person = me === "partner" ? "owner" : "partner";
  const personOf = (a: ApiActivity) => toPerson(a.actorUserId, members);
  const isNew = (a: ApiActivity) =>
    a.actorUserId !== myUserId && (!newSince || a.at > newSince);

  const visible = who === "all" ? activity : activity.filter((a) => personOf(a) === who);
  const fresh = activity.filter(isNew).length;

  const groups = new Map<string, ApiActivity[]>();
  for (const a of visible) groups.set(groupOf(a.at), [...(groups.get(groupOf(a.at)) ?? []), a]);
  const firstOld = visible.findIndex((a) => !isNew(a));
  const hasNew = visible.some(isNew);

  const filters: { key: Who; label: string }[] = [
    { key: "all", label: "All" },
    { key: me, label: "You" },
    { key: partner, label: name(partner) },
  ];

  return (
    <section className="card panel activity" aria-labelledby="activity-title">
      <div className="panel-head">
        <h2 id="activity-title">Recent activity</h2>
        <span className="activity-range">Last 7 days</span>
      </div>
      <div className="activity-tools">
        <p className="activity-summary">
          {fresh ? (
            <>
              <b>{name(partner)}</b> did {fresh} {fresh === 1 ? "thing" : "things"} since you last looked.
            </>
          ) : (
            "You're all caught up."
          )}
        </p>
        <div className="mini-seg" aria-label="Whose activity">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={who === f.key}
              onClick={() => setWho(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {activity.length
            ? "Nothing from this person in the last 7 days."
            : "Nothing yet this week. Finished tasks, new goals and plans will show up here."}
        </p>
      ) : (
        [...groups].map(([label, items]) => (
          <div key={label}>
            <h3 className="activity-day">{label}</h3>
            <ul>
              {items.map((a) => {
                const i = visible.indexOf(a);
                const goal = goals.find((g) => g.id === a.goalId);
                const person = personOf(a);
                const { icon: Icon, tone } = kinds[a.kind];
                // Steps and goal entries already name the goal in the sentence.
                const goalChip = goal && (a.kind === "task_added" || a.kind === "task_done");
                return (
                  <li key={a.id}>
                    {hasNew && i === 0 && isNew(a) && (
                      <p className="activity-divider">New since your last visit</p>
                    )}
                    {hasNew && i === firstOld && i > 0 && (
                      <p className="activity-divider seen">Seen before</p>
                    )}
                    <div
                      className={[
                        "activity-item",
                        isNew(a) && "is-new",
                        (a.kind === "goal_completed" || a.kind === "win_added") && "win",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className="activity-who">
                        <Avatars owner={person} />
                        <span className={`activity-kind tone-${tone}`} aria-hidden="true">
                          <Icon size={10} strokeWidth={3} />
                        </span>
                      </span>
                      <div className="activity-text">
                        <p>
                          <b>{a.actorUserId === myUserId ? "You" : name(person)}</b>{" "}
                          <Sentence a={a} goal={goal} />
                        </p>
                        {(a.whenAt || goalChip) && (
                          <p className="activity-sub">
                            {a.whenAt && <span>{whenLabel(a.whenAt)}</span>}
                            {goalChip && (
                              <span className="chip-goal">
                                <Heart aria-hidden="true" size={12} /> {goal.title}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <time className="activity-time" dateTime={a.at}>
                        {ago(a.at)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
