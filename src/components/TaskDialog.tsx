import { forwardRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import type { Goal, Person } from "../types";
import { usePeople } from "../helpers/people";
import { joinDue } from "../helpers/tasks";


// What the dialog opens with.
export interface TaskDraft {
  title?: string;
  owner?: Person;
  day: string; // "YYYY-MM-DD", today by default
  goalId?: string;
}

export interface NewTask {
  title: string;
  owner: Person;
  dueAt: string | null; // ISO; a day without a time is stored at local midnight
  goalId: string | null;
}

const TaskDialog = forwardRef<
  HTMLDialogElement,
  { draft: TaskDraft; goals: readonly Goal[]; onCreate: (task: NewTask) => void }
>(function TaskDialog({ draft, goals, onCreate }, ref) {
  const { choices, name } = usePeople();
  const [error, setError] = useState("");
  // Bumped on every close: the form remounts with the next draft's defaults.
  const [session, setSession] = useState(0);

  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError("Say what needs doing, e.g. “Book the theory test”.");
      e.currentTarget.querySelector<HTMLInputElement>("#task-title")?.focus();
      return;
    }
    const dueAt = joinDue(String(data.get("day") ?? ""), "");
    onCreate({
      title,
      owner: data.get("owner") as Person,
      dueAt,
      goalId: String(data.get("goal") ?? "") || null,
    });
    close();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="task-dialog-title"
      // No click-outside-to-close: a stray click shouldn't lose what was typed.
      // It closes on Add task, Cancel, or Esc.
      onClose={() => {
        setError("");
        setSession((s) => s + 1);
      }}
    >
      <form key={session} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="task-dialog-title">New task</h2>
        </div>

        <div className="field">
          <label htmlFor="task-title">Task</label>
          <input
            id="task-title"
            name="title"
            type="text"
            maxLength={200}
            autoComplete="off"
            defaultValue={draft.title}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "task-title-error" : undefined}
          />
          {error && (
            <p id="task-title-error" className="field-error" role="alert">
              <CircleAlert aria-hidden="true" size={16} />
              {error}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="task-owner">Who's doing it</label>
          <select id="task-owner" name="owner" defaultValue={draft.owner ?? "Both"}>
            {choices.map((o) => (
              <option key={o} value={o}>
                {name(o)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="task-day">Day</label>
          <input id="task-day" name="day" type="date" defaultValue={draft.day} />
        </div>

        {goals.length > 0 && (
          <div className="field">
            <label htmlFor="task-goal">Part of a goal</label>
            <select id="task-goal" name="goal" defaultValue={draft.goalId ?? ""}>
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Add task
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default TaskDialog;
