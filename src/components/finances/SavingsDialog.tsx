import { forwardRef, useState } from "react";
import { usePeople } from "../../helpers/people";
import {
  parseCents,
  type Fund,
  type Partner,
} from "../../helpers/finances";
import { closeRef, useSession } from "../../helpers/dialogs";
import { FieldError, MoneyInput } from "../dialogParts";

// Puts money into a fund. `fundId` preselects one.
const SavingsDialog = forwardRef<
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

export default SavingsDialog;
