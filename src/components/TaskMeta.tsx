import { CalendarDays, CircleAlert, Clock, NotebookText, Sun, Target } from "lucide-react";
import type { Goal, Task } from "../types";
import { dueLabel, hasTime } from "../helpers/tasks";

// The line under a task's title: when it's due, status, goal, notes.
export default function TaskMeta({
  task,
  goal,
  showStatus = true,
}: Readonly<{ task: Task; goal?: Goal; showStatus?: boolean }>) {
  const due = dueLabel(task);
  let DueIcon = CalendarDays;
  if (due?.tone === "overdue") DueIcon = CircleAlert;
  else if (due?.tone === "today") DueIcon = task.dueAt && hasTime(task.dueAt) ? Clock : Sun;

  return (
    <span className="task-meta">
      {due && (
        <span className={`due-${due.tone}`}>
          <DueIcon aria-hidden="true" size={14} />
          {due.text}
        </span>
      )}
      {showStatus && task.status === "In progress" && (
        <span className="status-chip">In progress</span>
      )}
      {goal && (
        <span className={`goal-chip cat-${goal.category.toLowerCase()}`}>
          <Target aria-hidden="true" size={12} />
          {goal.title}
        </span>
      )}
      {task.notes && (
        <span title="Has notes">
          <NotebookText aria-hidden="true" size={14} />
          <span className="sr-only">Has notes</span>
        </span>
      )}
    </span>
  );
}
