import { forwardRef, useState } from "react";
import { usePeople } from "../../helpers/people";
import {
  categories,
  parseCents,
  type Category,
} from "../../helpers/finances";
import { closeRef, useSession } from "../../helpers/dialogs";
import { FieldError, MoneyInput } from "../dialogParts";

// Monthly budget per category, and how "by income" splits.
const BudgetDialog = forwardRef<
  HTMLDialogElement,
  {
    budgets: Partial<Record<Category, number>>;
    incomeSplit: number;
    onSave: (budgets: Record<Category, number>, incomeSplit: number) => void;
  }
>(function BudgetDialog({ budgets, incomeSplit, onSave }, ref) {
  const { owner, partner } = usePeople();
  const [bad, setBad] = useState<Category | null>(null);
  const [share, setShare] = useState(incomeSplit);
  const [session, bump] = useSession();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const out = {} as Record<Category, number>;
    for (const c of categories) {
      const value = data.get(c.key);
      const text = (typeof value === "string" ? value : "").trim();
      const cents = text ? parseCents(text) : 0;
      if (cents === null) {
        setBad(c.key);
        e.currentTarget.querySelector<HTMLElement>(`#b-${c.key}`)?.focus();
        return;
      }
      out[c.key] = cents;
    }
    onSave(out, share);
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog finance-dialog"
      aria-labelledby="b-dialog-title"
      onClose={() => {
        setBad(null);
        setShare(incomeSplit); // start from the saved split next time
        bump();
      }}
    >
      <form key={session} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="b-dialog-title">Monthly budget</h2>
        </div>
        <p className="dialog-note">What you plan to spend together each month. Leave a category empty to skip it.</p>
        <div className="budget-fields">
          {categories.map(({ icon: Icon, ...c }) => (
            <div className="field" key={c.key}>
              {/* Same icon tile as the Shared Budget card, so each row is easy to match */}
              <label htmlFor={`b-${c.key}`} className="budget-label">
                <span className={`cat-icon cat-${c.key}`} aria-hidden="true">
                  <Icon size={14} />
                </span>
                {c.label}
              </label>
              <MoneyInput id={`b-${c.key}`} name={c.key} defaultCents={budgets[c.key]} error={bad === c.key} />
              {bad === c.key && <FieldError id={`b-${c.key}-error`}>Enter an amount, or leave it empty.</FieldError>}
            </div>
          ))}
        </div>
        <div className="field">
          <label htmlFor="b-split">Splitting by income</label>
          <input
            id="b-split"
            type="range"
            min={0}
            max={100}
            step={5}
            value={share}
            onChange={(e) => setShare(Number(e.target.value))}
            aria-valuetext={`${owner} ${share}%, ${partner ?? "partner"} ${100 - share}%`}
          />
          <p className="field-hint split-readout">
            <span>
              {owner} <b>{share}%</b>
            </span>
            <span>
              {partner ?? "Partner"} <b>{100 - share}%</b>
            </span>
          </p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save budget
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default BudgetDialog;
