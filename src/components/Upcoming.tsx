import { createElement, useState } from "react";
import { CalendarPlus, Check, CircleAlert, Flag, Plus, Target } from "lucide-react";
import type { CalendarEvent, Goal, Person, Task } from "../types";
import { checkIns, kindIcons, kindLabel } from "../helpers/events";
import type { CheckInSchedule } from "../helpers/checkins";
import { daysFromToday, hasTime } from "../helpers/tasks";
import Avatars from "./Avatars";
import { smoothly } from "../helpers/motion";

type Kind = "event" | "task" | "goal";
type Show = "all" | Kind;

interface Item {
  key: string;
  kind: Kind;
  date: Date;
  timed: boolean;
  title: string;
  owner: Person;
  event?: CalendarEvent;
  task?: Task;
  goal?: Goal;
}

const ranges = [
  { days: 14, label: "2 weeks" },
  { days: 31, label: "Month" },
  { days: 92, label: "3 months" },
] as const;

const shows: { key: Show; label: string }[] = [
  { key: "all", label: "All" },
  { key: "event", label: "Plans" },
  { key: "task", label: "Tasks" },
  { key: "goal", label: "Goals" },
];

const STRIP_DAYS = 14;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// "YYYY-MM-DD" -> local midnight
const fromDayKey = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const fmtWeekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: "short" });
const fmtMonthLong = new Intl.DateTimeFormat(undefined, { month: "long" });
const fmtMonthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

// "Later today", "Tomorrow", "Later this week", "Next week", then month names.
const bucketOf = (date: Date, now: Date) => {
  const d = daysFromToday(date.toISOString(), now);
  if (d <= 0) return "Later today";
  if (d === 1) return "Tomorrow";
  const toSunday = (7 - now.getDay()) % 7; // days left in this Mon–Sun week
  if (d <= toSunday) return "Later this week";
  if (d <= toSunday + 7) return "Next week";
  return date.getFullYear() === now.getFullYear()
    ? fmtMonthLong.format(date)
    : fmtMonthYear.format(date);
};

// "in 40 min", "in 3 h", "Tomorrow", "in 5 days", "in 3 weeks"
const relative = (item: Item, now: Date) => {
  const d = daysFromToday(item.date.toISOString(), now);
  if (d <= 0) {
    if (!item.timed) return "Today";
    const mins = Math.round((item.date.getTime() - now.getTime()) / 60_000);
    return mins < 60 ? `in ${Math.max(mins, 1)} min` : `in ${Math.round(mins / 60)} h`;
  }
  if (d === 1) return "Tomorrow";
  if (d < 14) return `in ${d} days`;
  return `in ${Math.round(d / 7)} weeks`;
};

// The round icon tile for a plan or goal, tinted by kind.
function KindIcon({ item, size, className }: Readonly<{ item: Item; size: number; className: string }>) {
  const tone = item.event ? `kind-${item.event.kind}` : "up-tone-goal";
  return (
    <span className={`${className} ${tone}`} aria-hidden="true">
      {item.event ? createElement(kindIcons[item.event.kind], { size }) : <Flag size={size} />}
    </span>
  );
}

export default function Upcoming({
  tasks,
  events,
  checkIn,
  goals,
  onToggleTask,
  onAddTask,
}: Readonly<{
  tasks: readonly Task[];
  events: readonly CalendarEvent[];
  checkIn: CheckInSchedule;
  goals: readonly Goal[];
  onToggleTask: (id: string) => void;
  onAddTask: () => void;
}>) {
  const [show, setShow] = useState<Show>("all");
  const [rangeDays, setRangeDays] = useState<number>(ranges[0].days);
  const [now] = useState(() => new Date());

  const today = startOfDay(now);
  // Everything from now to the end of the furthest range we offer
  const horizon = addDays(today, Math.max(rangeDays, STRIP_DAYS));

  const all: Item[] = [
    ...[...events, ...checkIns(checkIn, today, new Date(horizon.getTime() - 1))]
      // All-day plans count all day; timed ones until they start.
      .filter((e) => (e.allDay ? e.date >= today : e.date >= now) && e.date < horizon)
      .map((e) => ({
        key: `e-${e.id}`,
        kind: "event" as const,
        date: e.date,
        timed: !e.allDay,
        title: e.title,
        owner: e.owner,
        event: e,
      })),
    ...tasks
      .filter((t) => t.dueAt && new Date(t.dueAt) >= today && new Date(t.dueAt) < horizon)
      .map((t) => ({
        key: `t-${t.id}`,
        kind: "task" as const,
        date: new Date(t.dueAt!),
        timed: hasTime(t.dueAt!),
        title: t.title,
        owner: t.owner,
        task: t,
      })),
    ...goals
      .filter((g) => g.targetDate)
      .map((g) => ({ g, date: fromDayKey(g.targetDate!) }))
      .filter(({ date }) => date >= today && date < horizon)
      .map(({ g, date }) => ({
        key: `g-${g.id}`,
        kind: "goal" as const,
        date,
        timed: false,
        title: g.title,
        owner: g.owner,
        goal: g,
      })),
  ].sort((a, b) => {
    // Same day: all-day things first, then by time
    const byDay = startOfDay(a.date).getTime() - startOfDay(b.date).getTime();
    if (byDay) return byDay;
    if (a.timed !== b.timed) return a.timed ? 1 : -1;
    return a.date.getTime() - b.date.getTime();
  });

  const overdue = tasks
    .filter((t) => !t.done && t.dueAt && new Date(t.dueAt) < today)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));

  const rangeEnd = addDays(today, rangeDays);
  const visible = all.filter((i) => i.date < rangeEnd && (show === "all" || i.kind === show));
  const nextUp = all.find((i) => !(i.task?.done ?? false));

  // Day groups inside each bucket
  const buckets = new Map<string, Map<string, Item[]>>();
  for (const i of visible) {
    const b = bucketOf(i.date, now);
    const days = buckets.get(b) ?? new Map<string, Item[]>();
    const k = dayKey(i.date);
    days.set(k, [...(days.get(k) ?? []), i]);
    buckets.set(b, days);
  }

  // The two-week rhythm strip
  const strip = Array.from({ length: STRIP_DAYS }, (_, n) => {
    const d = addDays(today, n);
    const items = all.filter((i) => dayKey(i.date) === dayKey(d));
    return { d, items, plans: items.filter((i) => i.kind === "event").length };
  });
  const busiest = strip.reduce((a, b) => (b.items.length > a.items.length ? b : a), strip[0]);
  const freeDays = strip.filter((s) => s.plans === 0).length;
  const stripMax = Math.max(3, ...strip.map((s) => s.items.length));

  const jumpTo = (d: Date) => {
    setShow("all");
    // Wait for the list to re-render with everything showing
    requestAnimationFrame(() => {
      const el = document.getElementById(`up-day-${dayKey(d)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.focus({ preventScroll: true });
    });
  };

  const counts = {
    event: all.filter((i) => i.kind === "event" && i.date < rangeEnd).length,
    task: all.filter((i) => i.kind === "task" && i.date < rangeEnd && !i.task?.done).length,
    goal: all.filter((i) => i.kind === "goal" && i.date < rangeEnd).length,
  };
  const rangeLabel = ranges.find((r) => r.days === rangeDays)?.label.toLowerCase();

  return (
    <div className="upcoming">
      <div className="up-top">
        <NextUp item={nextUp} now={now} />

        <section className="card panel up-rhythm" aria-labelledby="rhythm-title">
          <div className="panel-head">
            <h2 id="rhythm-title">Next two weeks</h2>
            <span className="up-free">
              <b>{freeDays}</b> free {freeDays === 1 ? "day" : "days"}
            </span>
          </div>
          <div className="up-strip" role="group" aria-label="Jump to a day">
            {strip.map(({ d, items }) => {
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = dayKey(d) === dayKey(today);
              return (
                <button
                  key={dayKey(d)}
                  type="button"
                  className={`up-strip-day${weekend ? " weekend" : ""}${isToday ? " today" : ""}`}
                  disabled={items.length === 0}
                  aria-label={`${fmtDay.format(d)}${isToday ? ", today" : ""}: ${
                    items.length ? `${items.length} planned` : "free"
                  }`}
                  onClick={() => jumpTo(d)}
                >
                  <span className="up-strip-bar" aria-hidden="true">
                    <span style={{ height: `${(items.length / stripMax) * 100}%` }} />
                  </span>
                  <span className="up-strip-wd" aria-hidden="true">
                    {fmtWeekday.format(d).slice(0, 1)}
                  </span>
                  <span className="up-strip-num" aria-hidden="true">
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="up-insight">
            {busiest.items.length > 0 ? (
              <>
                Busiest: <b>{fmtDay.format(busiest.d)}</b> with {busiest.items.length}{" "}
                {busiest.items.length === 1 ? "thing" : "things"} on.
              </>
            ) : (
              "A wide-open fortnight. Time to plan something together?"
            )}
          </p>
        </section>
      </div>

      <section className="card panel up-agenda" aria-labelledby="agenda-title">
        <div className="panel-head">
          <div className="panel-title">
            <h2 id="agenda-title">Coming up</h2>
            <span className="count" aria-label={`${visible.length} items`}>
              {visible.length}
            </span>
          </div>
          <div className="up-actions">
            <a className="btn-ghost" href="#calendar">
              <CalendarPlus aria-hidden="true" size={16} /> Plan something
            </a>
            <button type="button" className="fab" aria-label="Add a task" onClick={onAddTask}>
              <Plus aria-hidden="true" size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="up-tools">
          <div className="mini-seg" aria-label="What to show">
            {shows.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={show === s.key}
                onClick={() => smoothly(() => setShow(s.key))}
              >
                {s.label}
                {s.key !== "all" && <span className="up-seg-count">{counts[s.key]}</span>}
              </button>
            ))}
          </div>
          <div className="mini-seg" aria-label="How far ahead">
            {ranges.map((r) => (
              <button
                key={r.days}
                type="button"
                aria-pressed={rangeDays === r.days}
                onClick={() => smoothly(() => setRangeDays(r.days))}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {overdue.length > 0 && (show === "all" || show === "task") && (
          <div className="up-overdue" role="group" aria-labelledby="overdue-title">
            <h3 id="overdue-title" className="up-overdue-head">
              <CircleAlert aria-hidden="true" size={16} />
              {overdue.length} {overdue.length === 1 ? "task" : "tasks"} slipped past their date
            </h3>
            <ul className="up-items">
              {overdue.map((t) => (
                <Row
                  key={t.id}
                  item={{
                    key: t.id,
                    kind: "task",
                    date: new Date(t.dueAt!),
                    timed: hasTime(t.dueAt!),
                    title: t.title,
                    owner: t.owner,
                    task: t,
                  }}
                  goals={goals}
                  onToggleTask={onToggleTask}
                  overdue
                />
              ))}
            </ul>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="empty up-empty">
            <p>
              {show === "all"
                ? `Nothing on the horizon for the next ${rangeLabel}.`
                : `No ${shows.find((s) => s.key === show)?.label.toLowerCase()} in the next ${rangeLabel}.`}
            </p>
            <p className="up-empty-sub">A quiet stretch is a good time to plan a date or a weekend away.</p>
          </div>
        ) : (
          [...buckets].map(([bucket, days]) => (
            <div key={bucket} className="up-bucket">
              <h3 className="activity-day">{bucket}</h3>
              {[...days].map(([k, items]) => {
                const d = fromDayKey(k);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={k}
                    id={`up-day-${k}`}
                    className="up-day"
                    tabIndex={-1}
                    aria-label={fmtDay.format(d)}
                  >
                    <div className={`up-date${isWeekend ? " weekend" : ""}`} aria-hidden="true">
                      <span className="up-date-wd">{fmtWeekday.format(d)}</span>
                      <span className="up-date-num">{d.getDate()}</span>
                      <span className="up-date-mo">{fmtMonth.format(d)}</span>
                    </div>
                    <ul className="up-items">
                      {items.map((i) => (
                        <Row key={i.key} item={i} goals={goals} onToggleTask={onToggleTask} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function NextUp({ item, now }: Readonly<{ item?: Item; now: Date }>) {
  if (!item)
    return (
      <section className="up-next" aria-labelledby="next-title">
        <p className="up-next-label" id="next-title">
          Next up
        </p>
        <p className="up-next-title">Your calendar is clear.</p>
        <p className="up-next-when">Add a plan and it will show up here.</p>
        <a className="up-next-link" href="#calendar">
          Open calendar
        </a>
      </section>
    );

  let what = "Task";
  if (item.kind === "event" && item.event) what = kindLabel(item.event.kind) ?? "Plan";
  if (item.kind === "goal") what = "Goal target date";

  return (
    <section className="up-next" aria-labelledby="next-title">
      <div className="up-next-top">
        <p className="up-next-label" id="next-title">
          Next up
        </p>
        <span className="up-next-rel">{relative(item, now)}</span>
      </div>
      <div className="up-next-main">
        {item.task ? (
          <span className="up-next-icon" aria-hidden="true">
            <Check size={26} />
          </span>
        ) : (
          <KindIcon item={item} size={26} className="up-next-icon" />
        )}
        <div className="up-next-text">
          <p className="up-next-title">{item.title}</p>
          <p className="up-next-when">
            {fmtDay.format(item.date)} · {item.timed ? fmtTime(item.date) : "All day"} · {what}
          </p>
        </div>
      </div>
      <div className="up-next-foot">
        <Avatars owner={item.owner} />
        <a className="up-next-link" href={item.kind === "task" ? "#tasks" : "#calendar"}>
          {item.kind === "task" ? "Open tasks" : "Open calendar"}
        </a>
      </div>
    </section>
  );
}

function Row({
  item,
  goals,
  onToggleTask,
  overdue = false,
}: Readonly<{
  item: Item;
  goals: readonly Goal[];
  onToggleTask: (id: string) => void;
  overdue?: boolean;
}>) {
  const t = item.task;
  const goal = t?.goalId ? goals.find((g) => g.id === t.goalId) : undefined;

  let meta: string;
  if (overdue) meta = `Was due ${fmtDay.format(item.date)}`;
  else if (item.kind === "goal") {
    const d = daysFromToday(item.date.toISOString());
    meta = d === 0 ? "Target date is today" : `Target date · ${d} ${d === 1 ? "day" : "days"} to go`;
  } else if (item.kind === "event" && item.event)
    meta = `${item.timed ? fmtTime(item.date) : "All day"} · ${kindLabel(item.event.kind)}`;
  else meta = item.timed ? fmtTime(item.date) : "Any time";

  return (
    <li className={`up-item${t?.done ? " done" : ""}${item.kind === "goal" ? " is-goal" : ""}`}>
      {t ? (
        <button
          type="button"
          className="check"
          aria-pressed={t.done}
          aria-label={`${t.done ? "Mark as not done" : "Mark as done"}: ${t.title}`}
          onClick={() => onToggleTask(t.id)}
        >
          <span>{t.done && <Check aria-hidden="true" size={14} strokeWidth={3} />}</span>
        </button>
      ) : (
        <KindIcon item={item} size={18} className="up-icon" />
      )}
      <div className="up-text">
        <span className="up-title">{item.title}</span>
        <span className={`up-meta${overdue ? " overdue" : ""}`}>
          {item.event?.recurring && <span className="up-tag">Repeats</span>}
          {meta}
          {goal && (
            <span className="up-goal">
              <Target aria-hidden="true" size={12} /> {goal.title}
            </span>
          )}
        </span>
      </div>
      <Avatars owner={item.owner} />
    </li>
  );
}
