import { forwardRef, useState } from "react";
import { Trash } from "lucide-react";
import type { Goal } from "../../types";
import {
  formatWhole,
  parseCents,
  type Fund,
} from "../../helpers/finances";
import { closeRef, useSession } from "../../helpers/dialogs";
import { FieldError, MoneyInput } from "../dialogParts";

export interface FundFields {
  name: string;
  targetCents: number;
  monthlyCents: number;
  goalId: string | null;
}

// Starts a fund, or edits `fund` when one is passed.
const FundDialog = forwardRef<
  HTMLDialogElement,
  {
    fund: Fund | null;
    saved: number; // what's in `fund`, for the delete warning
    goals: readonly Goal[];
    onSave: (fields: FundFields, id?: string) => void;
    onDelete: (id: string) => void;
  }
>(function FundDialog({ fund, saved, goals, onSave, onDelete }, ref) {
  const [errors, setErrors] = useState<{ name?: boolean; target?: boolean; monthly?: boolean }>({});
  const [confirming, setConfirming] = useState(false);
  const [session, bump] = useSession();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const nameValue = data.get("name");
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    const targetValue = data.get("target");
    const targetCents = parseCents(typeof targetValue === "string" ? targetValue : "");
    const monthlyValue = data.get("monthly");
    const monthlyText = typeof monthlyValue === "string" ? monthlyValue.trim() : "";
    const monthlyCents = monthlyText ? parseCents(monthlyText) : 0;
    const next = { name: !name, target: !targetCents, monthly: monthlyCents === null };
    setErrors(next);
    if (next.name || next.target || next.monthly) {
      let first = "#f-monthly";
      if (next.name) {
        first = "#f-name";
      } else if (next.target) {
        first = "#f-target";
      }
      e.currentTarget.querySelector<HTMLElement>(first)?.focus();
      return;
    }
    onSave(
      { name, targetCents: targetCents!, monthlyCents: monthlyCents!, goalId: String(data.get("goal") ?? "") || null },
      fund?.id,
    );
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog finance-dialog"
      aria-labelledby="f-dialog-title"
      onClose={() => {
        setErrors({});
        setConfirming(false);
        bump();
      }}
    >
      <form key={`${fund?.id ?? "new"}-${session}`} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="f-dialog-title">{fund ? "Edit fund" : "New fund"}</h2>
        </div>
        <div className="field">
          <label htmlFor="f-name">Fund name</label>
          <input
            id="f-name"
            name="name"
            type="text"
            maxLength={60}
            autoComplete="off"
            placeholder="e.g. Apartment fund"
            defaultValue={fund?.name}
            aria-invalid={errors.name || undefined}
            aria-describedby={errors.name ? "f-name-error" : undefined}
          />
          {errors.name && <FieldError id="f-name-error">Give the fund a name.</FieldError>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="f-target">Target</label>
            <MoneyInput id="f-target" name="target" defaultCents={fund?.targetCents} error={errors.target} />
            {errors.target && <FieldError id="f-target-error">Enter a target above €0.</FieldError>}
          </div>
          <div className="field">
            <label htmlFor="f-monthly">Each month</label>
            <MoneyInput id="f-monthly" name="monthly" defaultCents={fund?.monthlyCents} error={errors.monthly} />
            {errors.monthly ? (
              <FieldError id="f-monthly-error">Enter an amount, or leave it empty.</FieldError>
            ) : (
              <p className="field-hint">Optional. Shows when you'll get there.</p>
            )}
          </div>
        </div>
        {goals.length > 0 && (
          <div className="field">
            <label htmlFor="f-goal">For a goal</label>
            <select id="f-goal" name="goal" defaultValue={fund?.goalId ?? ""}>
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
          {fund &&
            (confirming ? (
              <button
                type="button"
                className="btn-danger dialog-delete"
                onClick={() => {
                  onDelete(fund.id);
                  closeRef(ref);
                }}
              >
                <Trash aria-hidden="true" size={16} />
                {saved ? `Delete it and its ${formatWhole(saved)}` : "Yes, delete it"}
              </button>
            ) : (
              <button type="button" className="btn-ghost-danger dialog-delete" onClick={() => setConfirming(true)}>
                <Trash aria-hidden="true" size={16} /> Delete fund
              </button>
            ))}
          <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {fund ? "Save changes" : "Create fund"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default FundDialog;
