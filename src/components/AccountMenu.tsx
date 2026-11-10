import { useEffect, useId, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import {
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
} from "lucide-react";
import Avatars from "./Avatars";
import { usePeople } from "../helpers/people";
import { useTheme, type ThemePref } from "../helpers/theme";
import type { SettingsTab } from "./SettingsDialog";

const themes: { key: ThemePref; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "Match system", icon: Monitor },
];

// "⌘" on Apple devices, "Ctrl" elsewhere, for the Settings shortcut hint.
const isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "");

// The sidebar's account button: the space, quick settings and your account in one menu.
export default function AccountMenu({ onOpenSettings }: Readonly<{ onOpenSettings: (tab: SettingsTab) => void }>) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { couple, partner } = usePeople();
  const { pref, setPref } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const items = () =>
      [...(rootRef.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    items()[0]?.focus();

    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      // Arrow keys, Home and End move between the menu's items.
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const go: Record<string, number> = {
        ArrowDown: at + 1,
        ArrowUp: at - 1,
        Home: 0,
        End: list.length - 1,
      };
      if (!(e.key in go)) return;
      e.preventDefault();
      list[(go[e.key] + list.length) % list.length]?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openSettings = (tab: SettingsTab) => {
    close(false);
    onOpenSettings(tab);
  };
  const email = user?.primaryEmailAddress?.emailAddress;
  const first = user?.firstName;

  return (
    <div className="account" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${couple}: account and settings`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatars owner={partner ? "Both" : "owner"} />
        <span className="account-text" aria-hidden="true">
          <span className="account-name">{couple}</span>
          {first && <span className="account-sub">Signed in as {first}</span>}
        </span>
        <ChevronsUpDown className="account-chevron" aria-hidden="true" size={16} />
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="Account and settings" className="account-menu">
          <div className="account-head">
            <Avatars owner={partner ? "Both" : "owner"} />
            <span>
              <strong>{couple}</strong>
              <span>Our space · {partner ? "2 members" : "Just you so far"}</span>
            </span>
          </div>

          <button type="button" role="menuitem" onClick={() => openSettings("profile")}>
            <Settings aria-hidden="true" size={16} /> Settings
            <kbd aria-hidden="true">{isMac ? "⌘ ," : "Ctrl ,"}</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => openSettings("partner")}>
            <UserPlus aria-hidden="true" size={16} /> {partner ? "Partner" : "Invite your partner"}
          </button>
          <div className="account-theme" role="group" aria-label="Theme">
            <span aria-hidden="true">
              <Moon aria-hidden="true" size={16} /> Theme
            </span>
            <span className="account-theme-options">
              {themes.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={pref === key}
                  aria-label={label}
                  title={label}
                  onClick={() => setPref(key)}
                >
                  <Icon aria-hidden="true" size={16} />
                </button>
              ))}
            </span>
          </div>

          <hr />
          <div className="account-me">
            {user?.hasImage ? (
              <img src={user.imageUrl} alt="" width={28} height={28} />
            ) : (
              <span className="avatar avatar-owner" aria-hidden="true">
                {(first ?? email ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{user?.fullName ?? first ?? "You"}</strong>
              {email && <span>{email}</span>}
            </span>
          </div>
          <button type="button" role="menuitem" onClick={() => openSettings("profile")}>
            <UserRound aria-hidden="true" size={16} /> Your profile
          </button>
          <button type="button" role="menuitem" onClick={() => openSettings("security")}>
            <ShieldCheck aria-hidden="true" size={16} /> Password &amp; security
          </button>
          <hr />
          <button type="button" role="menuitem" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
