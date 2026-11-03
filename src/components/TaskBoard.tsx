import { useState } from "react";
import { Circle, CircleCheck, CircleDot, GripVertical } from "lucide-react";
import type { Goal, Task, TaskStatus } from "../types";
import { byDoneAt, byDue, taskStatuses } from "../helpers/tasks";
import Avatars from "./Avatars";
import GoalMenu, { type MenuAction } from "./GoalMenu";
import TaskMeta from "./TaskMeta";

const statusIcons = { "To do": Circle, "In progress": CircleDot, Done: CircleCheck };
const emptyText: Record<TaskStatus, string> = {
  "To do": "All clear.",
  "In progress": "Drag something here when you start on it.",
  Done: "Finished tasks land here.",
};
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

export default function TaskBoard({
  tasks,
  goalOf,
  actionsFor,
  flashId,
  onOpen,
  onMove,
}: Readonly<{
  tasks: readonly Task[];
  goalOf: (t: Task) => Goal | undefined;
  actionsFor: (t: Task) => MenuAction[];
  flashId?: string;
  onOpen: (id: string) => void;
  onMove: (id: string, status: TaskStatus) => void;
}>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const drop = (status: TaskStatus) => {
    const task = tasks.find((t) => t.id === dragId);
    if (task && task.status !== status) onMove(task.id, status);
    setDragId(null);
    setOver(null);
  };

  return (
    <>
      <p className="board-tip">
        <GripVertical aria-hidden="true" size={16} />
        Drag cards between columns, or use a card's menu to move it.
      </p>
      <div className="board">
        {taskStatuses.map((status) => {
          const Icon = statusIcons[status];
          const list = tasks
            .filter((t) => t.status === status)
            .sort(status === "Done" ? byDoneAt : byDue);
          return (
            <section
              key={status}
              className={`board-col board-${slug(status)}${over === status ? " drop" : ""}`}
              aria-labelledby={`col-${slug(status)}`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(status);
              }}
            >
              <div className="board-head">
                <Icon aria-hidden="true" size={18} />
                <h2 id={`col-${slug(status)}`}>{status}</h2>
                <span className="count">{list.length}</span>
              </div>
              {list.length === 0 && <p className="board-empty">{emptyText[status]}</p>}
              {list.map((t) => (
                <article
                  key={t.id}
                  className={[
                    "card board-card",
                    t.done && "done",
                    t.id === dragId && "dragging",
                    t.id === flashId && "flash",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.id);
                    setDragId(t.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                >
                  <button
                    type="button"
                    className="task-main"
                    aria-haspopup="dialog"
                    onClick={() => onOpen(t.id)}
                  >
                    <span className="task-title">{t.title}</span>
                    <TaskMeta task={t} goal={goalOf(t)} showStatus={false} />
                  </button>
                  <div className="board-foot">
                    <Avatars owner={t.owner} />
                    <span>{t.owner === "Both" ? "Both of us" : t.owner}</span>
                    <GoalMenu label={`More options for ${t.title}`} actions={actionsFor(t)} />
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
