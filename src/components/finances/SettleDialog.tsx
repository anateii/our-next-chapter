import { forwardRef, useState } from "react";
import { usePeople } from "../../helpers/people";
import {
  formatMoney,
  parseCents,
  type Partner,
} from "../../helpers/finances";
import { closeRef, useSession } from "../../helpers/dialogs";
import { FieldError, MoneyInput } from "../dialogParts";

/* Settle up: pay back all of what's owed, or part of it */

const SettleDialog = forwardRef<
  HTMLDialogElement,
  {
    owed: number; // cents, > 0: the partner owes the owner (as balance() returns)
    onSave: (cents: number) => void;
  }
>(function SettleDialog({ owed, onSave }, ref) {
  const { name } = usePeople();
  const from: Partner = owed > 0 ? "partner" : "owner";
  const to: Partner = from === "owner" ? "partner" : "owner";
  const full = Math.abs(owed);
  const [text, setText] = useState("");
  const [error, setError] = useState<"" | "empty" | "too-much">("");
  const [session, bump] = useSession();

  // What the field holds now (it starts at the full amount), and what would be left.
  const typed = text === "" ? full : parseCents(text);
  const left = typed ? full - typed : full;

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amount = new FormData(e.currentTarget).get("amount");
    const cents = parseCents(typeof amount === "string" ? amount : "");
    let problem: "" | "empty" | "too-much" = "";
    if (!cents) {
      problem = "empty";
    } else if (cents > full) {
      problem = "too-much";
    }
    setError(problem);
    if (problem || !cents) {
      e.currentTarget.querySelector<HTMLElement>("#st-amount")?.focus();
      return;
    }
    onSave(cents);
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog finance-dialog"
      aria-labelledby="st-dialog-title"
      onClose={() => {
        setError("");
        setText("");
        bump();
      }}
    >
      <form
        key={`${full}-${session}`}
        onSubmit={submit}
        onChange={(e) => {
          // The amount field is uncontrolled; follow it for the "left" preview.
          const t: EventTarget = e.target;
          if (t instanceof HTMLInputElement && t.name === "amount") setText(t.value);
        }}
        noValidate
      >
        <div className="dialog-head">
          <h2 id="st-dialog-title">Settle up</h2>
        </div>
        <p className="dialog-note">
          {name(from)} owes {name(to)} <b>{formatMoney(full)}</b>. Pay it all back, or just part of it for now.
        </p>
        <div className="field">
          <label htmlFor="st-amount">
            {name(from)} pays {name(to)}
          </label>
          <MoneyInput id="st-amount" name="amount" defaultCents={full} error={!!error} />
          {error === "empty" && <FieldError id="st-amount-error">Enter an amount above €0, e.g. 100.</FieldError>}
          {error === "too-much" && (
            <FieldError id="st-amount-error">{`That's more than the ${formatMoney(full)} owed.`}</FieldError>
          )}
          {!error && (
            <p className="field-hint" aria-live="polite">
              {(() => {
                if (typed && typed <= full) {
                  return left === 0
                    ? "That settles everything: you'll be all square."
                    : `${formatMoney(left)} will be left between you.`;
                }
                return `Up to ${formatMoney(full)}.`;
              })()}
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Record payment
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default SettleDialog;
