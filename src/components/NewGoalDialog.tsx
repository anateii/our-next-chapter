import { forwardRef, useState } from "react";
import type { Goal, GoalCategory, Person } from "../types";
import { categoryIcons } from "../goals";
import PhotoField from "./PhotoField";

const categories = Object.keys(categoryIcons) as GoalCategory[];
const owners: Person[] = ["Both", "Ana", "Oliver"];

type NewGoal = Omit<Goal, "id">;
// The fields the dialog edits on an existing goal.
// (Next steps are left out until there's a Tasks page to put them in.)
export type GoalEdits = Pick<Goal, "title" | "category" | "owner" | "targetDate" | "image">;

// Creates a goal, or edits `goal` when one is passed.
const NewGoalDialog = forwardRef<
  HTMLDialogElement,
  {
    goal?: Goal | null;
    onCreate: (g: NewGoal) => void;
    onEdit: (id: string, edits: GoalEdits) => void;
  }
>(function NewGoalDialog({ goal, onCreate, onEdit }, ref) {
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
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o === "Both" ? "Both of us" : o}
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

export default NewGoalDialog;
