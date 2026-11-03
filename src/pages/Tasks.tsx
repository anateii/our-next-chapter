import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronRight, CircleAlert, LayoutGrid, List, Plus, Sun } from "lucide-react";
import type { Goal, Person, Task, TaskStatus } from "../types";
import {
  byDoneAt,
  byDue,
  daysFromToday,
  groupLabels,
  joinDue,
  localDay,
  splitDue,
  taskGroup,
  taskStatuses,
  type TaskEdits,
  type TaskGroup,
} from "../helpers/tasks";
import type { MenuAction } from "../components/GoalMenu";
import { usePeople } from "../helpers/people";
import Avatars from "../components/Avatars";
import TaskRow from "../components/TaskRow";
import TaskBoard from "../components/TaskBoard";
import TaskDetails from "../components/TaskDetails";
import "./Tasks.css";

type Who = "all" | Person;
const groupOrder: TaskGroup[] = ["overdue", "today", "tomorrow", "week", "later", "someday", "done"];
const groupHints: Partial<Record<TaskGroup, string>> = {
  overdue: "Catch up on these first",
  someday: "No day set yet",
  done: "Last 7 days",
};
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });

const RING_R = 21;
const RING_C = 2 * Math.PI * RING_R;

export default function Tasks({
  tasks,
  goals,
  me,
  onAdd,
  onUpdate,
  onChange,
  onToggle,
  onDelete,
}: Readonly<{
  tasks: readonly Task[];
  goals: readonly Goal[];
  me: Person; // "Both" when we can't tell which partner is signed in
  onAdd: () => void;
  onUpdate: (id: string, edits: TaskEdits) => Promise<boolean>; // silent, for the details panel
  onChange: (id: string, edits: TaskEdits, message: string) => void; // with an Undo toast
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}>) {
  const [who, setWho] = useState<Who>("all");
  // Board first, like the grid on Our Goals.
  const [view, setView] = useState<"board" | "list">("board");
  const [doneOpen, setDoneOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDialogElement>(null);

  const goalOf = (t: Task) => goals.find((g) => g.id === t.goalId);
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  const openDetails = (id: string) => {
    flushSync(() => setOpenId(id));
    detailsRef.current?.showModal();
  };

  // The open task was deleted (here or by the other partner): close the panel.
  useEffect(() => {
    if (openId && !openTask) detailsRef.current?.close();
  }, [openId, openTask]);

  // "N" opens New task, like the hint on the button says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if (e.key.toLowerCase() !== "n" || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      onAdd();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAdd]);

  // Filters: all, then each partner ("Mine" for the signed-in one), then the
  // tasks you share ("Both of us" as the owner).
  const { name, partner } = usePeople();
  const people: Person[] = partner ? ["owner", "partner"] : ["owner"];
  const whoOptions: { key: Who; label: string }[] = [
    { key: "all", label: "All" },
    ...people.map((p) => ({ key: p, label: p === me ? "Mine" : name(p) })),
    { key: "Both", label: "Shared" },
  ];
  const visible = who === "all" ? tasks : tasks.filter((t) => t.owner === who);
  const openCount = (w: Who) =>
    tasks.filter((t) => !t.done && (w === "all" || t.owner === w)).length;

  // Summary
  const dueToday = visible.filter((t) => !t.done && t.dueAt && daysFromToday(t.dueAt) === 0).length;
  const overdue = visible.filter((t) => taskGroup(t) === "overdue").length;
  const thisWeek = visible.filter((t) => t.done || (t.dueAt && daysFromToday(t.dueAt) <= 7));
  const doneThisWeek = thisWeek.filter((t) => t.done).length;
  const weekShare = thisWeek.length ? doneThisWeek / thisWeek.length : 0;

  const groups = new Map<TaskGroup, Task[]>();
  for (const t of visible) {
    const g = taskGroup(t);
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }

  const statusMessage = (t: Task, s: TaskStatus) =>
    s === "Done" ? `Done: ${t.title}` : `Moved to ${s.toLowerCase()}`;

  const actionsFor = (t: Task): MenuAction[] => {
    const isTomorrow = t.dueAt && daysFromToday(t.dueAt) === 1;
    return [
      { label: "Open details", onSelect: () => openDetails(t.id) },
      ...taskStatuses
        .filter((s) => s !== t.status)
        .map((s) => ({
          label: s === "Done" ? "Mark as done" : `Move to ${s.toLowerCase()}`,
          onSelect: () => onChange(t.id, { status: s }, statusMessage(t, s)),
        })),
      ...(t.done || isTomorrow
        ? []
        : [
            {
              label: "Push to tomorrow",
              onSelect: () =>
                onChange(t.id, { dueAt: joinDue(localDay(1), splitDue(t.dueAt).time) }, "Pushed to tomorrow"),
            },
          ]),
      { label: "Delete task", onSelect: () => onDelete(t.id) },
    ];
  };

  const rows = (list: Task[]) => (
    <ul className="tasks">
      {list.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          goal={goalOf(t)}
          actions={actionsFor(t)}
          onToggle={onToggle}
          onOpen={openDetails}
        />
      ))}
    </ul>
  );

  let emptyTitle = "No tasks yet";
  if (tasks.length) {
    if (who === me) emptyTitle = "Nothing on your plate";
    else if (who === "Both") emptyTitle = "Nothing shared right now";
    else if (who !== "all") emptyTitle = `Nothing for ${name(who)}`;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Tasks
          </h1>
          <p>The little things that move us forward.</p>
        </div>
        <button type="button" className="btn-primary" aria-keyshortcuts="n" onClick={onAdd}>
          <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> New task
        </button>
      </header>

      <section className="stats tasks-stats" aria-label="Summary">
        <div className="card stat">
          <span className="stat-icon tint-accent" aria-hidden="true">
            <Sun size={22} />
          </span>
          <div>
            <strong>{dueToday}</strong>
            <span>Left for today</span>
          </div>
        </div>
        <div className="card stat">
          <span className="stat-icon tint-peach" aria-hidden="true">
            <CircleAlert size={22} />
          </span>
          <div>
            <strong>{overdue}</strong>
            <span>Overdue</span>
          </div>
        </div>
        <div className="card stat">
          <svg className="ring" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r={RING_R} className="ring-track" />
            <circle
              cx="26"
              cy="26"
              r={RING_R}
              className="ring-value"
              strokeDasharray={`${weekShare * RING_C} ${RING_C}`}
              transform="rotate(-90 26 26)"
            />
          </svg>
          <div>
            <strong>
              {doneThisWeek}
              <span className="stat-of"> / {thisWeek.length}</span>
            </strong>
            <span>Done this week</span>
          </div>
        </div>
      </section>

      <div className="goals-toolbar">
        <div className="segmented" aria-label="Whose tasks">
          {whoOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.key === who}
              className={o.key === who ? "active" : ""}
              onClick={() => setWho(o.key)}
            >
              {o.key !== "all" && <Avatars owner={o.key} />}
              {/* One span, so the count shares the label's line (the button
                  centres each flex item on its own, which lifts the smaller count) */}
              <span>
                {o.label} <span className="seg-count">{openCount(o.key)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="view-toggle" aria-label="Layout">
          <button
            type="button"
            className="icon-btn"
            aria-label="Board view"
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <LayoutGrid aria-hidden="true" size={18} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? "task" : "tasks"}
      </p>

      {visible.length === 0 && (
        <div className="card goals-empty">
          <h2>{emptyTitle}</h2>
          <p>
            {tasks.length
              ? "Enjoy the breathing room, or add something new."
              : "Add the first small step towards your next chapter."}
          </p>
          {tasks.length > 0 ? (
            <button type="button" className="btn-secondary" onClick={() => setWho("all")}>
              Show all tasks
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onAdd}>
              <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> Add your first task
            </button>
          )}
        </div>
      )}

      {visible.length > 0 && view === "board" && (
        <TaskBoard
          tasks={visible}
          goalOf={goalOf}
          actionsFor={actionsFor}
          onOpen={openDetails}
          onMove={(id, s) => {
            const t = tasks.find((x) => x.id === id);
            if (t) onChange(id, { status: s }, statusMessage(t, s));
          }}
        />
      )}

      {visible.length > 0 && view === "list" && (
        <div className="task-groups">
          {groupOrder.map((g) => {
            const list = (groups.get(g) ?? []).sort(g === "done" ? byDoneAt : byDue);
            if (!list.length && g !== "today") return null;
            if (g === "done")
              return (
                <section key={g} className="card panel task-group group-done" aria-labelledby="group-done">
                  <div className="panel-head">
                    <button
                      type="button"
                      id="group-done"
                      className="done-toggle"
                      aria-expanded={doneOpen}
                      aria-controls="done-list"
                      onClick={() => setDoneOpen((o) => !o)}
                    >
                      <ChevronRight aria-hidden="true" size={18} />
                      <h2>Done</h2>
                      <span className="count">{list.length}</span>
                    </button>
                    <span className="panel-sub">{groupHints.done}</span>
                  </div>
                  <div id="done-list" hidden={!doneOpen}>
                    {rows(list)}
                  </div>
                </section>
              );
            return (
              <section key={g} className={`card panel task-group group-${g}`} aria-labelledby={`group-${g}`}>
                <div className="panel-head">
                  <div className="panel-title">
                    <h2 id={`group-${g}`}>{groupLabels[g]}</h2>
                    <span className="count">{list.length}</span>
                  </div>
                  <span className="panel-sub">
                    {g === "today" ? longDate.format(new Date()) : groupHints[g]}
                  </span>
                </div>
                {list.length ? rows(list) : <p className="empty">Nothing left for today. Enjoy the breathing room.</p>}
              </section>
            );
          })}
        </div>
      )}

      <TaskDetails
        ref={detailsRef}
        task={openTask}
        goals={goals}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
