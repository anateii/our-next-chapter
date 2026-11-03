import { forwardRef, useState } from "react";
import { X } from "lucide-react";
import type { Goal, GoalCategory, Person } from "../types";
import { categoryIcons } from "../goals";

const categories = Object.keys(categoryIcons) as GoalCategory[];
const owners: Person[] = ["Both", "Ana", "Oliver"];

type NewGoal = Omit<Goal, "id">;

const NewGoalDialog = forwardRef<HTMLDialogElement, { onCreate: (g: NewGoal) => void }>(
  function NewGoalDialog({ onCreate }, ref) {
    const [error, setError] = useState("");

    const close = (form: HTMLFormElement) => {
      form.reset();
      setError("");
      (ref as React.RefObject<HTMLDialogElement | null>).current?.close();
    };

    const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const title = String(data.get("title") ?? "").trim();
      if (!title) {
        setError("Give your goal a name, e.g. “Weekend in Lisbon”.");
        e.currentTarget.querySelector<HTMLInputElement>("#goal-title")?.focus();
        return;
      }
      const nextStep = String(data.get("nextStep") ?? "").trim();
      onCreate({
        title,
        category: data.get("category") as GoalCategory,
        owner: data.get("owner") as Person,
        nextStep: nextStep || undefined,
        stepsDone: 0,
        stepsTotal: nextStep ? 1 : 0,
      });
      close(e.currentTarget);
    };

    return (
      <dialog
        ref={ref}
        className="dialog"
        aria-labelledby="new-goal-title"
        onClick={(e) => {
          // Clicking the backdrop closes the dialog.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        onClose={() => setError("")}
      >
        <form onSubmit={submit} noValidate>
          <div className="dialog-head">
            <h2 id="new-goal-title">New goal</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close"
              onClick={(e) => close(e.currentTarget.form!)}
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="goal-title">Goal name</label>
            <input
              id="goal-title"
              name="title"
              type="text"
              maxLength={80}
              autoComplete="off"
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
              <select id="goal-category" name="category" defaultValue="Travel">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="goal-owner">Who's leading</label>
              <select id="goal-owner" name="owner" defaultValue="Both">
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o === "Both" ? "Both of us" : o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="goal-next">First step</label>
            <input id="goal-next" name="nextStep" type="text" maxLength={120} autoComplete="off" />
            <p className="field-hint">Optional. The smallest thing you could do next.</p>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={(e) => close(e.currentTarget.form!)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create goal
            </button>
          </div>
        </form>
      </dialog>
    );
  },
);

export default NewGoalDialog;
