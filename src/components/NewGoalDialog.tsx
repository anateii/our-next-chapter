import { forwardRef, useState } from "react";
import { Check } from "lucide-react";
import type { Goal, GoalCategory, Person } from "../types";
import { categoryIcons, type GoalSteps } from "../goals";
import { usePeople } from "../helpers/people";
import PhotoField from "./PhotoField";

const categories = Object.keys(categoryIcons) as GoalCategory[];

type NewGoal = Omit<Goal, "id">;
// The fields the dialog edits on an existing goal. Steps aren't part of
// them: they're tasks, saved as soon as they're added or ticked.
export type GoalEdits = Pick<Goal, "title" | "category" | "owner" | "targetDate" | "image">;

// Creates a goal, or edits `goal` when one is passed.
const NewGoalDialog = forwardRef<
  HTMLDialogElement,
  {
    goal?: Goal | null;
    steps?: GoalSteps;
    onCreate: (g: NewGoal) => void;
    onEdit: (id: string, edits: GoalEdits) => void;
    onAddStep: (goal: Goal, title: string) => Promise<unknown>;
    onToggleStep: (taskId: string) => void;
  }
>(function NewGoalDialog(
  { goal, steps, onCreate, onEdit, onAddStep, onToggleStep },
  ref,
) {
  const { choices, name } = usePeople();
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  // Bumped on every close: the form remounts, dropping unsaved typing and photos.
  const [session, setSession] = useState(0);

  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError("Give your goal a name, e.g. “Weekend in Lisbon”.");
      e.currentTarget.querySelector<HTMLInputElement>("#goal-title")?.focus();
      return;
    }
    const targetDate = String(data.get("targetDate") ?? "");
    const image = String(data.get("image") ?? "");
    const fields: GoalEdits = {
      title,
      category: data.get("category") as GoalCategory,
      owner: data.get("owner") as Person,
      targetDate: targetDate || undefined,
      image: image || undefined,
    };
    if (goal) onEdit(goal.id, fields);
    else onCreate({ ...fields, stepsDone: 0, stepsTotal: 0 });
    close();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="new-goal-title"
      // No click-outside-to-close: a stray click shouldn't lose what was typed.
      // It closes on Save, Cancel, or Esc.
      onClose={() => {
        // However it closed (Cancel, Esc, backdrop), start fresh next time.
        setError("");
        setPhotoBusy(false);
        setSession((s) => s + 1);
      }}
    >
      {/* key: a new goal, another goal or a new session remounts the fields with fresh defaults */}
      <form key={`${goal?.id ?? "new"}-${session}`} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="new-goal-title">{goal ? "Edit goal" : "New goal"}</h2>
        </div>

        <PhotoField initial={goal?.image} onBusyChange={setPhotoBusy} />

        <div className="field">
          <label htmlFor="goal-title">Goal name</label>
          <input
            id="goal-title"
            name="title"
            type="text"
            maxLength={80}
            autoComplete="off"
            defaultValue={goal?.title}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "goal-title-error" : undefined}
          />
          {error && (
            <p id="goal-title-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="goal-category">Category</label>
            <select id="goal-category" name="category" defaultValue={goal?.category ?? "Travel"}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="goal-owner">Who's leading</label>
            <select id="goal-owner" name="owner" defaultValue={goal?.owner ?? "Both"}>
              {choices.map((o) => (
                <option key={o} value={o}>
                  {name(o)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="goal-date">Target date</label>
          <input
            id="goal-date"
            name="targetDate"
            type="date"
            defaultValue={goal?.targetDate}
          />
        </div>

        {goal ? (
          <StepsField
            goal={goal}
            steps={steps}
            onAdd={onAddStep}
            onToggle={onToggleStep}
          />
        ) : (
          <p className="field-hint">You can add steps once the goal is created.</p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={photoBusy}>
            {goal ? "Save changes" : "Create goal"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

// The goal's open steps, to tick off, and a field to add more.
function StepsField({
  goal,
  steps,
  onAdd,
  onToggle,
}: Readonly<{
  goal: Goal;
  steps?: GoalSteps;
  onAdd: (goal: Goal, title: string) => Promise<unknown>;
  onToggle: (taskId: string) => void;
}>) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const total = steps?.total ?? 0;
  // Ticked steps stay listed (and can be unticked): the Undo toast sits
  // behind this dialog.
  const listed = [...(steps?.open ?? []), ...(steps?.recentDone ?? [])];

  const add = () => {
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    void onAdd(goal, t).then((created) => {
      if (created) setTitle(""); // on failure, keep the typing for a retry
      setAdding(false);
    });
  };

  return (
    <section className="goal-steps" aria-labelledby="goal-steps-title">
      <div className="goal-steps-head">
        <h3 id="goal-steps-title">Steps</h3>
        {total > 0 && (
          <span className="field-hint">
            {steps?.done} of {total} done
          </span>
        )}
      </div>
      {listed.length > 0 && (
        <ul>
          {listed.map((t) => (
            <li key={t.id} className={t.done ? "done" : undefined}>
              <button
                type="button"
                className="check"
                aria-pressed={t.done}
                aria-label={`${t.done ? "Mark as not done" : "Mark as done"}: ${t.title}`}
                onClick={() => onToggle(t.id)}
              >
                <span>
                  <Check aria-hidden="true" size={14} strokeWidth={3} />
                </span>
              </button>
              <span className="goal-step-title">{t.title}</span>
              {t.status === "In progress" && <span className="step-chip">In progress</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="field goal-step-add">
        <input
          type="text"
          aria-label="New step"
          placeholder={total ? "Add a step" : "First step, e.g. Book flights"}
          maxLength={200}
          autoComplete="off"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the step instead of submitting the goal form.
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={adding || !title.trim()}
          onClick={add}
        >
          Add
        </button>
      </div>
      <p className="field-hint">
        Steps save straight away and show on the Tasks page under Someday.
      </p>
    </section>
  );
}

export default NewGoalDialog;
