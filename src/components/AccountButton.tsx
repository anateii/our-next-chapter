import { useUser } from "@clerk/react";
import { Settings } from "lucide-react";
import Avatars from "./Avatars";
import { usePeople } from "../helpers/people";
import type { SettingsTab } from "./SettingsDialog";

// The sidebar's account button: shows the couple and opens Settings straight away.
export default function AccountButton({ onOpenSettings }: Readonly<{ onOpenSettings: (tab: SettingsTab) => void }>) {
  const { user } = useUser();
  const { couple, partner } = usePeople();
  const first = user?.firstName;

  return (
    <div className="account">
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="dialog"
        aria-label={`${couple}: open settings`}
        onClick={() => onOpenSettings("profile")}
      >
        <Avatars owner={partner ? "Both" : "owner"} />
        <span className="account-text" aria-hidden="true">
          <span className="account-name">{couple}</span>
          {first && <span className="account-sub">Signed in as {first}</span>}
        </span>
        <Settings className="account-chevron" aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
