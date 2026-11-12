import type { CheckInSchedule } from "../helpers/checkins";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import type { CalendarEvent, Goal, Person, Task } from "../types";
import {
  checkIns,
  kindIcons,
  kindLabel,
  moveToDay,
  type EventEdits,
} from "../helpers/events";
import { joinDue, splitDue, type TaskEdits } from "../helpers/tasks";
import { parseDay } from "../helpers/goals";
import { usePeople } from "../helpers/people";
import Avatars from "../components/Avatars";
import EventDialog, { type NewEvent } from "../components/EventDialog";
import "./Calendar.css";
import { smoothly } from "../helpers/motion";

type Who = "all" | Person;
type Layer = "events" | "tasks" | "goals" | "checkins";
type Item =
  | { type: "event"; sort: string; event: CalendarEvent }
  | { type: "task"; sort: string; task: Task }
  | { type: "goal"; sort: string; goal: Goal };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => parseDay(k);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const fmt = {
  month: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }),
  long: new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }),
  short: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }),
  weekday: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
  monthShort: new Intl.DateTimeFormat(undefined, { month: "short" }),
};
// "Today", "Tomorrow", or the weekday name
const relDay = (d: Date) => {
  const n = Math.round((fromKey(keyOf(d)).getTime() - startOfToday().getTime()) / 86_400_000);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long" });
};

const layerLabels: { key: Layer; label: string }[] = [
  { key: "events", label: "Events" },
  { key: "tasks", label: "Tasks" },
  { key: "goals", label: "Goal dates" },
  { key: "checkins", label: "Check-ins" },
];

export default function Calendar({
  events,
  checkIn,
  tasks,
  goals,
  me,
  onCreate,
  onUpdate,
  onChange,
  onDelete,
  onToggleTask,
  onChangeTask,
}: Readonly<{
  events: readonly CalendarEvent[];
  checkIn: CheckInSchedule;
  tasks: readonly Task[];
  goals: readonly Goal[];
  me: Person;
  onCreate: (e: NewEvent) => void;
  onUpdate: (id: string, edits: EventEdits) => Promise<boolean>;
  onChange: (id: string, edits: EventEdits, message: string) => void; // with Undo
  onDelete: (id: string) => void;
  onToggleTask: (id: string) => void;
  onChangeTask: (id: string, edits: TaskEdits, message: string) => void;
}>) {
  const { name, partner } = usePeople();
  const today = startOfToday();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => keyOf(today));
  const [view, setView] = useState<"month" | "list">("month");
  const [who, setWho] = useState<Who>("all");
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    events: true,
    tasks: true,
    goals: true,
    checkins: true,
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  // Event dialog: the event being edited (null = a new one) and its default day.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [dialogDay, setDialogDay] = useState(selected);
  const openDialog = (event: CalendarEvent | null, day = selected) => {
    flushSync(() => {
      setEditing(event);
      setDialogDay(day);
    });
    dialogRef.current?.showModal();
  };

  const forWho = (owner: Person) => who === "all" || owner === who;

  // Everything on one day ("YYYY-MM-DD") that the filters let through.
  const itemsOn = (day: string): Item[] => {
    const d = fromKey(day);
    const items: Item[] = [];
    if (layers.events)
      for (const e of events)
        if (keyOf(e.date) === day && forWho(e.owner))
          items.push({ type: "event", sort: e.allDay ? "00:00" : e.date.toTimeString(), event: e });
    if (layers.checkins && (who === "all" || who === "Both"))
      for (const c of checkIns(checkIn, d, d))
        items.push({ type: "event", sort: "00:00", event: c });
    if (layers.tasks)
      for (const t of tasks)
        if (t.dueAt && keyOf(new Date(t.dueAt)) === day && forWho(t.owner))
          items.push({ type: "task", sort: "99", task: t });
    if (layers.goals)
      for (const g of goals)
        if (g.targetDate === day && forWho(g.owner)) items.push({ type: "goal", sort: "00", goal: g });
    return items.sort((a, b) => a.sort.localeCompare(b.sort));
  };

  // Moving an event or task to another day (drag and drop), with Undo.
  const moveTo = (id: string, day: string) => {
    const label = fmt.short.format(fromKey(day));
    const ev = events.find((e) => e.id === id);
    if (ev) {
      if (keyOf(ev.date) !== day)
        onChange(id, { startsAt: moveToDay(ev, day) }, `Moved “${ev.title}” to ${label}`);
    } else {
      const t = tasks.find((x) => x.id === id);
      if (t?.dueAt && keyOf(new Date(t.dueAt)) !== day)
        onChangeTask(id, { dueAt: joinDue(day, splitDue(t.dueAt).time) }, `Moved “${t.title}” to ${label}`);
    }
    setSelected(day);
  };

  const goToMonth = (d: Date) => setCursor(new Date(d.getFullYear(), d.getMonth(), 1));

  const whoOptions: { key: Who; label: string }[] = [
    { key: "all", label: "All" },
    { key: "owner", label: me === "owner" ? "Mine" : name("owner") },
    ...(partner ? [{ key: "partner" as Who, label: me === "partner" ? "Mine" : name("partner") }] : []),
    { key: "Both", label: "Shared" },
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Calendar
          </h1>
          <p>Plans for the two of us.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => openDialog(null)}>
          <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> New event
        </button>
      </header>

      <div className="cal-toolbar">
        <div className="cal-nav">
          {view === "month" && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => goToMonth(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
          )}
          <h2 className="cal-title" aria-live="polite">
            {view === "month" ? fmt.month.format(cursor) : "Next 30 days"}
          </h2>
          {view === "month" && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Next month"
              onClick={() => goToMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          )}
        </div>
        <div className="view-toggle" aria-label="Layout">
          <button
            type="button"
            className="icon-btn"
            aria-label="Month view"
            aria-pressed={view === "month"}
            onClick={() => smoothly(() => setView("month"))}
          >
            <LayoutGrid aria-hidden="true" size={18} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => smoothly(() => setView("list"))}
          >
            <List aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <div className="cal-filters">
        <div className="segmented" aria-label="Whose plans">
          {whoOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.key === who}
              className={o.key === who ? "active" : ""}
              onClick={() => smoothly(() => setWho(o.key))}
            >
              {o.key !== "all" && <Avatars owner={o.key} />}
              {o.label}
            </button>
          ))}
        </div>
        <div className="cal-layers" role="group" aria-label="What to show">
          {layerLabels.map((l) => (
            <button
              key={l.key}
              type="button"
              className="cal-layer"
              aria-pressed={layers[l.key]}
              onClick={() => setLayers((s) => ({ ...s, [l.key]: !s[l.key] }))}
            >
              <span className={`swatch swatch-${l.key}`} aria-hidden="true" />
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <div className="cal-wrap">
          <MonthGrid
            cursor={cursor}
            today={today}
            selected={selected}
            itemsOn={itemsOn}
            dragId={dragId}
            overDay={overDay}
            onSelect={setSelected}
            onOpenEvent={(e) => openDialog(e)}
            onDragStart={setDragId}
            onDragEnd={() => {
              setDragId(null);
              setOverDay(null);
            }}
            onDragOver={setOverDay}
            onDrop={(day) => {
              if (dragId) moveTo(dragId, day);
              setDragId(null);
              setOverDay(null);
            }}
          />
          <DayPanel
            day={selected}
            items={itemsOn(selected)}
            onOpenEvent={(e) => openDialog(e)}
            onToggleTask={onToggleTask}
            onAdd={() => openDialog(null, selected)}
          />
        </div>
      ) : (
        <Agenda
          today={today}
          itemsOn={itemsOn}
          onOpenEvent={(e) => openDialog(e)}
          onToggleTask={onToggleTask}
        />
      )}

      <EventDialog
        ref={dialogRef}
        event={editing}
        day={dialogDay}
        onCreate={(e) => {
          onCreate(e);
          const day = keyOf(new Date(e.startsAt));
          setSelected(day);
          goToMonth(fromKey(day));
        }}
        onSave={(id, edits) => {
          void onUpdate(id, edits);
          if (edits.startsAt) setSelected(keyOf(new Date(edits.startsAt)));
        }}
        onDelete={onDelete}
      />
    </>
  );
}

// One small line in a day cell. Events and tasks can be dragged to another day;
// the check-in repeats, so it stays put.
function Chip({
  item,
  dragging,
  onOpenEvent,
  onSelect,
  onDragStart,
  onDragEnd,
}: Readonly<{
  item: Item;
  dragging: boolean;
  onOpenEvent: (e: CalendarEvent) => void;
  onSelect: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}>) {
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      onDragStart(id);
    },
    onDragEnd,
  });

  if (item.type === "event") {
    const e = item.event;
    return (
      <button
        type="button"
        className={`cal-chip kind-${e.kind}${dragging ? " dragging" : ""}`}
        title={`${e.title}${e.time ? `, ${e.time}` : ""}`}
        onClick={(ev) => {
          ev.stopPropagation();
          if (e.recurring) onSelect();
          else onOpenEvent(e);
        }}
        {...(e.recurring ? {} : dragProps(e.id))}
      >
        {e.time && <span className="chip-time">{e.time}</span>}
        <span className="chip-title">{e.title}</span>
      </button>
    );
  }
  if (item.type === "task") {
    const t = item.task;
    return (
      <button
        type="button"
        className={`cal-chip chip-task${t.done ? " done" : ""}${dragging ? " dragging" : ""}`}
        title={`Task: ${t.title}`}
        onClick={(ev) => {
          ev.stopPropagation();
          onSelect();
        }}
        {...dragProps(t.id)}
      >
        <span className="chip-box" aria-hidden="true" />
        <span className="chip-title">{t.title}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="cal-chip chip-goal"
      title={`Goal target date: ${item.goal.title}`}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect();
      }}
    >
      <Flag aria-hidden="true" size={12} />
      <span className="chip-title">{item.goal.title}</span>
    </button>
  );
}

const dotClass = (it: Item) =>
  it.type === "event" ? `swatch-kind-${it.event.kind}` : it.type === "task" ? "swatch-tasks" : "swatch-goals";

function MonthGrid({
  cursor,
  today,
  selected,
  itemsOn,
  dragId,
  overDay,
  onSelect,
  onOpenEvent,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Readonly<{
  cursor: Date;
  today: Date;
  selected: string;
  itemsOn: (day: string) => Item[];
  dragId: string | null;
  overDay: string | null;
  onSelect: (day: string) => void;
  onOpenEvent: (e: CalendarEvent) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (day: string) => void;
  onDrop: (day: string) => void;
}>) {
  const start = mondayOf(cursor);
  const end = addDays(mondayOf(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)), 6);
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const weekdays = days.slice(0, 7).map((d) => fmt.weekday.format(d));
  const todayKey = keyOf(today);

  return (
    <section className="card cal-month" aria-label={fmt.month.format(cursor)}>
      <div className="cal-dow" aria-hidden="true">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-grid">
        {days.map((d) => {
          const day = keyOf(d);
          const items = itemsOn(day);
          const shown = items.slice(0, 3);
          const more = items.length - shown.length;
          const id = (it: Item) =>
            it.type === "event" ? it.event.id : it.type === "task" ? it.task.id : `goal-${it.goal.id}`;
          return (
            <div
              key={day}
              className={[
                "cal-cell",
                d.getMonth() !== cursor.getMonth() && "out",
                day === todayKey && "today",
                day === selected && "selected",
                (d.getDay() === 0 || d.getDay() === 6) && "weekend",
                overDay === day && "drop",
              ]
                .filter(Boolean)
                .join(" ")}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (overDay !== day) onDragOver(day);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(day);
              }}
            >
              <button
                type="button"
                className="cal-hit"
                aria-pressed={day === selected}
                aria-label={`${fmt.long.format(d)}${day === todayKey ? ", today" : ""}${
                  items.length ? `, ${items.length} ${items.length === 1 ? "thing" : "things"}` : ""
                }`}
                onClick={() => onSelect(day)}
              />
              <span className="cal-num" aria-hidden="true">
                {d.getDate()}
              </span>
              {shown.map((it) => (
                <Chip
                  key={id(it)}
                  item={it}
                  dragging={dragId === id(it)}
                  onOpenEvent={onOpenEvent}
                  onSelect={() => onSelect(day)}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
              {more > 0 && (
                <button type="button" className="cal-more" onClick={() => onSelect(day)}>
                  +{more} more
                </button>
              )}
              <span className="cal-dots" aria-hidden="true">
                {items.slice(0, 4).map((it) => (
                  <i key={id(it)} className={dotClass(it)} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// One row in the day panel or the list: an event to open, a task to tick, or a goal date.
function ItemRow({
  item,
  onOpenEvent,
  onToggleTask,
}: Readonly<{
  item: Item;
  onOpenEvent: (e: CalendarEvent) => void;
  onToggleTask: (id: string) => void;
}>) {
  const { name } = usePeople();
  if (item.type === "event") {
    const e = item.event;
    const Icon = kindIcons[e.kind];
    const sub = [e.time || "All day", kindLabel(e.kind), e.recurring ? `Every ${fmt.long.format(e.date).split(",")[0]}` : name(e.owner)]
      .filter(Boolean)
      .join(" · ");
    const body = (
      <>
        <span className="item-title">{e.title}</span>
        <span className="item-sub">{sub}</span>
      </>
    );
    return (
      <li>
        <span className={`event-icon kind-${e.kind}`} aria-hidden="true">
          <Icon size={18} />
        </span>
        {e.recurring ? (
          <div className="item-main">{body}</div>
        ) : (
          <button type="button" className="item-main" aria-haspopup="dialog" onClick={() => onOpenEvent(e)}>
            {body}
          </button>
        )}
        {!e.recurring && <Avatars owner={e.owner} />}
      </li>
    );
  }
  if (item.type === "task") {
    const t = item.task;
    return (
      <li className={t.done ? "done" : ""}>
        <button
          type="button"
          className="check"
          aria-pressed={t.done}
          aria-label={`${t.done ? "Mark as not done" : "Mark as done"}: ${t.title}`}
          onClick={() => onToggleTask(t.id)}
        >
          <span>
            <Check aria-hidden="true" size={14} strokeWidth={3} />
          </span>
        </button>
        <div className="item-main">
          <span className="item-title">{t.title}</span>
          <span className="item-sub">Task{t.time ? ` · ${t.time}` : ""}</span>
        </div>
        <Avatars owner={t.owner} />
      </li>
    );
  }
  const g = item.goal;
  return (
    <li>
      <span className="event-icon kind-checkin" aria-hidden="true">
        <Flag size={18} />
      </span>
      <a className="item-main" href="#goals">
        <span className="item-title">{g.title}</span>
        <span className="item-sub">Goal target date</span>
      </a>
    </li>
  );
}

function DayPanel({
  day,
  items,
  onOpenEvent,
  onToggleTask,
  onAdd,
}: Readonly<{
  day: string;
  items: Item[];
  onOpenEvent: (e: CalendarEvent) => void;
  onToggleTask: (id: string) => void;
  onAdd: () => void;
}>) {
  const d = fromKey(day);
  const rel = relDay(d);
  return (
    <aside className="card cal-day" aria-labelledby="cal-day-title">
      <div>
        <p className="cal-eyebrow">{["Today", "Tomorrow", "Yesterday"].includes(rel) ? rel : `${fmt.monthShort.format(d)} ${d.getFullYear()}`}</p>
        <h3 id="cal-day-title">{fmt.long.format(d)}</h3>
      </div>
      {items.length ? (
        <ul className="cal-items">
          {items.map((it) => (
            <ItemRow
              key={it.type === "event" ? it.event.id : it.type === "task" ? it.task.id : it.goal.id}
              item={it}
              onOpenEvent={onOpenEvent}
              onToggleTask={onToggleTask}
            />
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing planned. A free day together?</p>
      )}
      <button type="button" className="btn-secondary" onClick={onAdd}>
        <Plus aria-hidden="true" size={18} /> Add an event on this day
      </button>
      <p className="cal-hint">Drag an event or task in the month to move it to another day.</p>
    </aside>
  );
}

function Agenda({
  today,
  itemsOn,
  onOpenEvent,
  onToggleTask,
}: Readonly<{
  today: Date;
  itemsOn: (day: string) => Item[];
  onOpenEvent: (e: CalendarEvent) => void;
  onToggleTask: (id: string) => void;
}>) {
  const days = Array.from({ length: 31 }, (_, i) => addDays(today, i))
    .map((d) => ({ d, items: itemsOn(keyOf(d)) }))
    .filter((x) => x.items.length);
  return (
    <section className="card cal-agenda" aria-label="Next 30 days">
      {days.length === 0 && <p className="empty">Nothing in the next 30 days.</p>}
      {days.map(({ d, items }, i) => (
        <div key={keyOf(d)} className={`cal-agenda-day${i === 0 && keyOf(d) === keyOf(today) ? " is-today" : ""}`}>
          <div className="cal-agenda-date">
            <span className="num">{d.getDate()}</span>
            <strong>{relDay(d)}</strong>
            <span>
              {fmt.weekday.format(d)}, {fmt.monthShort.format(d)}
            </span>
          </div>
          <ul className="cal-items">
            {items.map((it) => (
              <ItemRow
                key={it.type === "event" ? it.event.id : it.type === "task" ? it.task.id : it.goal.id}
                item={it}
                onOpenEvent={onOpenEvent}
                onToggleTask={onToggleTask}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
