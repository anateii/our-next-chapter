import { useState } from "react";

// Shared by the app's <dialog> forms (Finances, Our Space).
type DialogRef = React.RefObject<HTMLDialogElement | null>;
export const closeRef = (ref: React.ForwardedRef<HTMLDialogElement>) => (ref as DialogRef).current?.close();

// Keeps a dialog's form fresh: bumped on every close, so the next open remounts it.
export function useSession() {
  const [session, setSession] = useState(0);
  return [session, () => setSession((s) => s + 1)] as const;
}
