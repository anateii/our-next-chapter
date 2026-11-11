import { forwardRef, useState } from "react";
import { Trash } from "lucide-react";
import { usePeople } from "../../helpers/people";
import {
  categories,
  dayKey,
  parseCents,
  type Category,
  type Expense,
  type Partner,
  type Split,
} from "../../helpers/finances";
import { closeRef, useSession } from "../../helpers/dialogs";
import { FieldError, MoneyInput } from "../dialogParts";

const splitOptions = (owner: string, partner: string, incomeSplit: number) =>
  [
    { split: "equal", label: "Split equally", hint: "50 / 50" },
    { split: "income", label: "By income", hint: `${owner} ${incomeSplit} · ${partner} ${100 - incomeSplit}` },
    { split: "owner", label: `All for ${owner}`, hint: `${partner} paid for ${owner}` },
    { split: "partner", label: `All for ${partner}`, hint: `${owner} paid for ${partner}` },
  ] as { split: Split; label: string; hint: string }[];

export interface ExpenseFields {
  title: string;
  cents: number;
  day: string;
  category: Category;
  paidBy: Partner;
  split: Split;
}

// Adds an expense, or edits `expense` when one is passed.
const ExpenseDialog = forwardRef<
  HTMLDialogElement,
  {
    expense: Expense | null;
    me: Partner;
    incomeSplit: number;
    onSave: (fields: ExpenseFields, id?: string) => void;
    onDelete: (id: string) => void;
  }
>(function ExpenseDialog({ expense, me, incomeSplit, onSave, onDelete }, ref) {
  const { owner, partner, name } = usePeople();
  const [errors, setErrors] = useState<{ title?: boolean; amount?: boolean }>({});
  const [session, bump] = useSession();
  const partnerName = partner ?? "Your partner";

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const cents = parseCents(String(data.get("amount") ?? ""));
    const next = { title: !title, amount: !cents };
    setErrors(next);
    if (next.title || next.amount) {
      e.currentTarget.querySelector<HTMLElement>(next.title ? "#x-title" : "#x-amount")?.focus();
      return;
    }
    onSave(
      {
        title,
        cents: cents!,
        day: String(data.get("day") || dayKey(new Date())),
        category: data.get("category") as Category,
        paidBy: data.get("paidBy") as Partner,
        split: data.get("split") as Split,
      },
      expense?.id,
    );
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog finance-dialog"
      aria-labelledby="x-dialog-title"
      onClose={() => {
        setErrors({});
        bump();
      }}
    >
      <form key={`${expense?.id ?? "new"}-${session}`} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="x-dialog-title">{expense ? "Edit expense" : "Add expense"}</h2>
        </div>
        <div className="field">
          <label htmlFor="x-title">What was it</label>
          <input
            id="x-title"
            name="title"
            type="text"
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. Weekly shop"
            defaultValue={expense?.title}
            aria-invalid={errors.title || undefined}
            aria-describedby={errors.title ? "x-title-error" : undefined}
          />
          {errors.title && <FieldError id="x-title-error">Say what it was, e.g. “Groceries”.</FieldError>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="x-amount">Amount</label>
            <MoneyInput id="x-amount" name="amount" defaultCents={expense?.cents} error={errors.amount} />
            {errors.amount && <FieldError id="x-amount-error">Enter an amount above €0, e.g. 42.50.</FieldError>}
          </div>
          <div className="field">
            <label htmlFor="x-day">Day</label>
            <input id="x-day" name="day" type="date" defaultValue={expense?.day ?? dayKey(new Date())} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="x-paid">Paid by</label>
            <select id="x-paid" name="paidBy" defaultValue={expense?.paidBy ?? me}>
              <option value="owner">{name("owner")}{me === "owner" ? " (you)" : ""}</option>
              {partner && (
                <option value="partner">{name("partner")}{me === "partner" ? " (you)" : ""}</option>
              )}
            </select>
          </div>
          <div className="field">
            <label htmlFor="x-category">Category</label>
            <select id="x-category" name="category" defaultValue={expense?.category ?? "food"}>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="field">
          <legend className="field-label">How to split it</legend>
          <div className="split-choice">
            {splitOptions(owner, partnerName, incomeSplit).map((o) => (
              <label key={o.split}>
                <input
                  type="radio"
                  name="split"
                  value={o.split}
                  defaultChecked={(expense?.split ?? "equal") === o.split}
                />
                <span>
                  {o.label}
                  <small>{o.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="dialog-actions">
          {expense && (
            <button
              type="button"
              className="btn-ghost-danger dialog-delete"
              onClick={() => {
                onDelete(expense.id);
                closeRef(ref);
              }}
            >
              <Trash aria-hidden="true" size={16} /> Delete
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {expense ? "Save changes" : "Add expense"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default ExpenseDialog;
