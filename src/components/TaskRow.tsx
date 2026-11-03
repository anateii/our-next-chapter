import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { Goal, Task } from "../types";
import Avatars from "./Avatars";
import GoalMenu, { type MenuAction } from "./GoalMenu";
import TaskMeta from "./TaskMeta";

const reducedMotion = () => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function TaskRow({
  task,
  goal,
  flash,
  actions,
  onToggle,
  onOpen,
}: Readonly<{
  task: Task;
  goal?: Goal;
  flash?: boolean;
  actions: MenuAction[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}>) {
  // Let the tick land before the row moves to Done.
  const [completing, setCompleting] = useState(false);
  const toggle = () => {
    if (task.done || reducedMotion()) return onToggle(task.id);
    setCompleting(true);
    setTimeout(() => onToggle(task.id), 400);
  };
  const done = task.done || completing;

  return (
    <li
      className={["task", done && "done", completing && "completing", flash && "flash"]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={`check${task.status === "In progress" ? " in-progress" : ""}`}
        aria-pressed={task.done}
        aria-label={`${task.done ? "Mark as not done" : "Mark as done"}: ${task.title}`}
        disabled={completing}
        onClick={toggle}
      >
        <span>
          <Check aria-hidden="true" size={14} strokeWidth={3} />
        </span>
      </button>
      <button
        type="button"
        className="task-main"
        aria-haspopup="dialog"
        onClick={() => onOpen(task.id)}
      >
        <span className="task-title">{task.title}</span>
        <TaskMeta task={task} goal={goal} />
        <ChevronRight className="open-hint" aria-hidden="true" size={18} />
      </button>
      <Avatars owner={task.owner} />
      <GoalMenu label={`More options for ${task.title}`} actions={actions} />
    </li>
  );
}
