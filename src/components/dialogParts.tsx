import { CircleAlert, X } from "lucide-react";
import { closeRef } from "../helpers/dialogs";

// Small pieces shared by the app's forms and dialogs.

// An error under a field; `id` is what the field's aria-describedby points at.
export function FieldError({ id, children }: Readonly<{ id: string; children: string }>) {
  return (
    <p id={id} className="field-error" role="alert">
      <CircleAlert aria-hidden="true" size={16} />
      {children}
    </p>
  );
}

// The × in a dialog's corner.
export function CloseButton({ dialog }: Readonly<{ dialog: React.ForwardedRef<HTMLDialogElement> }>) {
  return (
    <button type="button" className="icon-btn" aria-label="Close" onClick={() => closeRef(dialog)}>
      <X aria-hidden="true" size={20} />
    </button>
  );
}

// An amount field with a € in front; the value is typed text, parsed on submit.
export function MoneyInput({
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
