import { forwardRef, useState } from "react";
import { CircleAlert, Trash } from "lucide-react";
import type { Goal } from "../types";
import { usePeople } from "../helpers/people";
import {
  categories,
  dayKey,
  formatWhole,
  parseCents,
  type Category,
  type Expense,
  type Fund,
  type Partner,
  type Split,
} from "../helpers/finances";

type DialogRef = React.RefObject<HTMLDialogElement | null>;
const closeRef = (ref: React.ForwardedRef<HTMLDialogElement>) => (ref as DialogRef).current?.close();

// Keeps a dialog's form fresh: bumped on every close, so the next open remounts it.
function useSession() {
  const [session, setSession] = useState(0);
  return [session, () => setSession((s) => s + 1)] as const;
}

function FieldError({ id, children }: Readonly<{ id: string; children: string }>) {
  return (
    <p id={id} className="field-error" role="alert">
      <CircleAlert aria-hidden="true" size={16} />
      {children}
    </p>
  );
}

// An amount field with a € in front; the value is typed text, parsed on submit.
function MoneyInput({
  id,
  name,
  defaultCents,
  error,
}: Readonly<{ id: string; name: string; defaultCents?: number; error?: boolean }>) {
  return (
    <div className="money-input">
      <span aria-hidden="true">€</span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={defaultCents ? (defaultCents / 100).toFixed(2) : ""}
        aria-invalid={error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </div>
  );
}

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
export const ExpenseDialog = forwardRef<
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

// Puts money into a fund. `fundId` preselects one.
export const SavingsDialog = forwardRef<
  HTMLDialogElement,
  {
    funds: readonly Fund[];
    fundId: string | null;
    me: Partner;
    onSave: (fundId: string, cents: number, who: Partner) => void;
    onNewFund: () => void;
  }
>(function SavingsDialog({ funds, fundId, me, onSave, onNewFund }, ref) {
  const { partner, name } = usePeople();
  const [error, setError] = useState(false);
  const [session, bump] = useSession();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const cents = parseCents(String(data.get("amount") ?? ""));
    setError(!cents);
    if (!cents) {
      e.currentTarget.querySelector<HTMLElement>("#s-amount")?.focus();
      return;
    }
    onSave(String(data.get("fund")), cents, data.get("who") as Partner);
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog finance-dialog"
      aria-labelledby="s-dialog-title"
      onClose={() => {
        setError(false);
        bump();
      }}
    >
      <form key={`${fundId ?? "any"}-${session}`} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="s-dialog-title">Add to savings</h2>
        </div>
        {funds.length === 0 ? (
          <>
            <p className="dialog-note">Start a fund first, then add money to it.</p>
            <div className="dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  closeRef(ref);
                  onNewFund();
                }}
              >
                New fund
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="s-fund">Fund</label>
              <select id="s-fund" name="fund" defaultValue={fundId ?? funds[0].id}>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="s-amount">Amount</label>
                <MoneyInput id="s-amount" name="amount" error={error} />
                {error && <FieldError id="s-amount-error">Enter an amount above €0, e.g. 150.</FieldError>}
              </div>
              <div className="field">
                <label htmlFor="s-who">From</label>
                <select id="s-who" name="who" defaultValue={me}>
                  <option value="owner">{name("owner")}{me === "owner" ? " (you)" : ""}</option>
                  {partner && (
                    <option value="partner">{name("partner")}{me === "partner" ? " (you)" : ""}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Add to fund
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
});

export interface FundFields {
  name: string;
  targetCents: number;
  monthlyCents: number;
  goalId: string | null;
}

// Starts a fund, or edits `fund` when one is passed.
export const FundDialog = forwardRef<
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
    const name = String(data.get("name") ?? "").trim();
    const targetCents = parseCents(String(data.get("target") ?? ""));
    const monthlyText = String(data.get("monthly") ?? "").trim();
    const monthlyCents = monthlyText ? parseCents(monthlyText) : 0;
    const next = { name: !name, target: !targetCents, monthly: monthlyCents === null };
    setErrors(next);
    if (next.name || next.target || next.monthly) {
      const first = next.name ? "#f-name" : next.target ? "#f-target" : "#f-monthly";
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

// Monthly budget per category, and how "by income" splits.
export const BudgetDialog = forwardRef<
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
      const text = String(data.get(c.key) ?? "").trim();
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
          {categories.map((c) => (
            <div className="field" key={c.key}>
              <label htmlFor={`b-${c.key}`}>{c.label}</label>
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
