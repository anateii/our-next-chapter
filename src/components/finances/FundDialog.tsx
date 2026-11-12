import { forwardRef, useState } from "react";
import { Trash } from "lucide-react";
import type { Goal } from "../../types";
import { dayKey, formatWhole, parseCents, planText, type Fund } from "../../helpers/finances";
import { closeRef, useSession } from "../../helpers/dialogs";
import { FieldError, MoneyInput } from "../dialogParts";

export interface FundFields {
  name: string;
  targetCents: number;
  monthlyCents: number;
  goalId: string | null;
  startDay: string;
  endDay: string | null;
}

// The form's current values, for the live plan line.
const readPlan = (form: HTMLFormElement) => {
  const data = new FormData(form);
  const text = (key: string) => {
    const v = data.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    targetCents: parseCents(text("target")) ?? 0,
    monthlyCents: parseCents(text("monthly")) ?? 0,
    startDay: text("start") || dayKey(new Date()),
    endDay: text("end") || undefined,
  };
};

// Starts a fund, or edits `fund` when one is passed.
const FundDialog = forwardRef<
  HTMLDialogElement,
  {
    fund: Fund | null;
    saved: number; // what's in `fund`, for the delete warning and the plan line
    paidThisMonth: number; // what's gone into `fund` this month
    goals: readonly Goal[];
    onSave: (fields: FundFields, id?: string) => void;
    onDelete: (id: string) => void;
  }
>(function FundDialog({ fund, saved, paidThisMonth, goals, onSave, onDelete }, ref) {
  const [errors, setErrors] = useState<{ name?: boolean; target?: boolean; monthly?: boolean; end?: boolean }>({});
  // Typed values, so the plan line follows along; null until the form changes.
  const [plan, setPlan] = useState<ReturnType<typeof readPlan> | null>(null);
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
    const startValue = data.get("start");
    const startDay = (typeof startValue === "string" && startValue) || dayKey(new Date());
    const endValue = data.get("end");
    const endDay = (typeof endValue === "string" && endValue) || null;
    const next = {
      name: !name,
      target: !targetCents,
      monthly: monthlyCents === null,
      end: endDay !== null && endDay < startDay,
    };
    setErrors(next);
    if (next.name || next.target || next.monthly || next.end) {
      let first = "#f-end";
      if (next.name) {
        first = "#f-name";
      } else if (next.target) {
        first = "#f-target";
      } else if (next.monthly) {
        first = "#f-monthly";
      }
      e.currentTarget.querySelector<HTMLElement>(first)?.focus();
      return;
    }
    onSave(
      {
        name,
        targetCents: targetCents!,
        monthlyCents: monthlyCents!,
        goalId: String(data.get("goal") ?? "") || null,
        startDay,
        endDay,
      },
      fund?.id,
    );
    closeRef(ref);
  };

  const current = plan ?? {
    targetCents: fund?.targetCents ?? 0,
    monthlyCents: fund?.monthlyCents ?? 0,
    startDay: fund?.startDay ?? dayKey(new Date()),
    endDay: fund?.endDay,
  };
  const planLine = current.targetCents
    ? planText({
        left: current.targetCents - saved,
        monthly: current.monthlyCents,
        paidThisMonth,
        startDay: current.startDay,
        endDay: current.endDay && current.endDay >= current.startDay ? current.endDay : undefined,
      })
    : null;

  return (
    <dialog
      ref={ref}
      className="dialog finance-dialog"
      aria-labelledby="f-dialog-title"
      onClose={() => {
        setErrors({});
        setConfirming(false);
        setPlan(null);
        bump();
      }}
    >
      <form
        key={`${fund?.id ?? "new"}-${session}`}
        onSubmit={submit}
        onInput={(e) => setPlan(readPlan(e.currentTarget))}
        noValidate
      >
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
        <fieldset className="field">
          <legend className="sr-only">Timeframe</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-start">From</label>
              <input id="f-start" name="start" type="date" defaultValue={fund?.startDay ?? dayKey(new Date())} />
            </div>
            <div className="field">
              <label htmlFor="f-end">Until</label>
              <input
                id="f-end"
                name="end"
                type="date"
                // "" not undefined: React leaves the old date in place when this becomes undefined.
                defaultValue={fund?.endDay ?? ""}
                aria-invalid={errors.end || undefined}
                aria-describedby={errors.end ? "f-end-error" : "f-end-hint"}
              />
              {errors.end ? (
                <FieldError id="f-end-error">Pick a day after the start.</FieldError>
              ) : (
                <p id="f-end-hint" className="field-hint">Optional. When you want to reach the target.</p>
              )}
            </div>
          </div>
        </fieldset>
        {planLine && (
          <p className="dialog-note fund-plan" aria-live="polite">
            {planLine}
          </p>
        )}
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
