import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import {
  CalendarDays,
  Check,
  Copy,
  Heart,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { usePeople } from "../helpers/people";
import { useTheme, type ThemePref } from "../helpers/theme";
import { frequencies, weekdays, type CheckInEvery, type CheckInSchedule } from "../helpers/checkins";
import type { ApiMember } from "../helpers/goals";
import "./SettingsDialog.css";

export type SettingsTab = "profile" | "security" | "appearance" | "space" | "partner" | "checkins";

export interface SpaceFields {
  name?: string;
  checkInDay?: string;
  checkInEvery?: CheckInEvery;
}

const tabs: { key: SettingsTab; label: string; icon: typeof Heart; group: "Account" | "Our space" }[] = [
  { key: "profile", label: "Profile", icon: UserRound, group: "Account" },
  { key: "security", label: "Password & security", icon: ShieldCheck, group: "Account" },
  { key: "appearance", label: "Appearance", icon: Moon, group: "Account" },
  { key: "space", label: "Space name", icon: Heart, group: "Our space" },
  { key: "partner", label: "Partner", icon: UserPlus, group: "Our space" },
  { key: "checkins", label: "Check-ins", icon: CalendarDays, group: "Our space" },
];

interface Props {
  tab: SettingsTab | null; // null = closed
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
  spaceName: string;
  checkIn: CheckInSchedule;
  members: readonly ApiMember[];
  myUserId: string | null | undefined;
  // Each resolves true once saved; the caller shows the toast.
  onSaveSpace: (fields: SpaceFields) => Promise<boolean>;
  onSaveName: (displayName: string) => Promise<boolean>;
  onInvite: () => Promise<{ code: string; expiresAt: string } | null>;
}

export default function SettingsDialog(props: Readonly<Props>) {
  const { tab, onTab, onClose } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const { signOut } = useClerk();

  // Open and close the native dialog with `tab`.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (tab && !d.open) d.showModal();
    if (!tab && d.open) d.close();
  }, [tab]);

  const current = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <dialog
      ref={ref}
      className="dialog settings"
      aria-labelledby="settings-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself: close.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <nav className="settings-nav" aria-label="Settings sections">
        {(["Account", "Our space"] as const).map((group) => (
          <div key={group} className="settings-group">
            <p className="settings-group-label">{group}</p>
            {tabs
              .filter((t) => t.group === group)
              .map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className="settings-tab"
                  aria-current={key === current.key ? "page" : undefined}
                  onClick={() => onTab(key)}
                >
                  <Icon aria-hidden="true" size={16} /> <span>{label}</span>
                </button>
              ))}
          </div>
        ))}
        <button type="button" className="settings-tab settings-signout" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" size={16} /> <span>Sign out</span>
        </button>
      </nav>

      <div className="settings-pane">
        <div className="dialog-head">
          <h2 id="settings-title">{current.label}</h2>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        {/* key: switching tabs starts each form fresh from the saved values */}
        {tab && <Pane key={current.key} which={current.key} {...props} />}
      </div>
    </dialog>
  );
}

function Pane({ which, ...p }: Readonly<Props & { which: SettingsTab }>) {
  switch (which) {
    case "profile":
      return <ProfilePane onSaveName={p.onSaveName} />;
    case "security":
      return <SecurityPane onClose={p.onClose} />;
    case "appearance":
      return <AppearancePane />;
    case "space":
      return <SpacePane name={p.spaceName} onSave={p.onSaveSpace} />;
    case "partner":
      return <PartnerPane members={p.members} myUserId={p.myUserId} onInvite={p.onInvite} />;
    case "checkins":
      return <CheckInsPane checkIn={p.checkIn} onSave={p.onSaveSpace} />;
  }
}

// Save button state shared by the forms: busy while saving.
function useSave() {
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<boolean>) => {
    setBusy(true);
    try {
      return await work();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
}

function SaveButton({ busy, disabled }: Readonly<{ busy: boolean; disabled?: boolean }>) {
  return (
    <div className="dialog-actions">
      <button type="submit" className="btn-primary" disabled={busy || disabled} aria-busy={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

/* Account */

function ProfilePane({ onSaveName }: Readonly<{ onSaveName: Props["onSaveName"] }>) {
  const { user } = useUser();
  const { partner } = usePeople();
  const [first, setFirst] = useState(user?.firstName ?? "");
  const [last, setLast] = useState(user?.lastName ?? "");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [busy, run] = useSave();
  const fileRef = useRef<HTMLInputElement>(null);

  const changed = first.trim() !== (user?.firstName ?? "") || last.trim() !== (user?.lastName ?? "");

  const setPhoto = async (file: File | null) => {
    if (!user) return;
    setPhotoBusy(true);
    setPhotoError(false);
    try {
      await user.setProfileImage({ file });
    } catch (err) {
      console.error("Changing photo failed:", err);
      setPhotoError(true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = first.trim();
    if (!user || !firstName) return;
    void run(async () => {
      try {
        await user.update({ firstName, lastName: last.trim() });
      } catch (err) {
        console.error("Saving profile failed:", err);
        return false;
      }
      return onSaveName(firstName);
    });
  };

  return (
    <form className="settings-form" onSubmit={submit}>
      <div className="settings-photo">
        {user?.hasImage ? (
          <img src={user.imageUrl} alt="Your photo" width={72} height={72} />
        ) : (
          <span className="avatar avatar-owner" aria-hidden="true">
            {(first || "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <div className="settings-photo-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
            >
              {photoBusy ? "Uploading…" : user?.hasImage ? "Change photo" : "Add a photo"}
            </button>
            {user?.hasImage && (
              <button type="button" className="btn-ghost" disabled={photoBusy} onClick={() => void setPhoto(null)}>
                Remove
              </button>
            )}
          </div>
          {photoError && (
            <p className="field-error" role="alert">
              Couldn't change your photo. Try a JPG or PNG under 10 MB.
            </p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void setPhoto(file);
          }}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="set-first">First name</label>
          <input
            id="set-first"
            value={first}
            maxLength={40}
            required
            autoComplete="given-name"
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="set-last">Last name</label>
          <input
            id="set-last"
            value={last}
            maxLength={40}
            autoComplete="family-name"
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
      </div>
      <p className="field-hint">
        {partner ? partner : "Your partner"} sees your first name on shared goals, tasks and plans.
      </p>
      <SaveButton busy={busy} disabled={!changed || !first.trim()} />
    </form>
  );
}

function SecurityPane({ onClose }: Readonly<{ onClose: () => void }>) {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  return (
    <div className="settings-form">
      <div className="field">
        <label htmlFor="set-email">Email</label>
        <input id="set-email" value={user?.primaryEmailAddress?.emailAddress ?? ""} readOnly />
      </div>
      <p className="settings-text">
        You sign in with this email. Change it, set a password, or see the devices that are signed
        in, in your sign-in settings.
      </p>
      <div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            // Close first: our dialog sits above everything else on the page.
            onClose();
            openUserProfile();
          }}
        >
          <ShieldCheck aria-hidden="true" size={16} /> Manage email, password &amp; devices
        </button>
      </div>
    </div>
  );
}

function AppearancePane() {
  const { pref, setPref } = useTheme();
  const options: { key: ThemePref; label: string; hint: string; icon: typeof Sun }[] = [
    { key: "light", label: "Light", hint: "Bright and airy", icon: Sun },
    { key: "dark", label: "Dark", hint: "Easy on the eyes at night", icon: Moon },
    { key: "system", label: "Match system", hint: "Follows this device", icon: Monitor },
  ];
  return (
    <fieldset className="settings-form settings-choices">
      <legend className="settings-text">Choose how the app looks on this device.</legend>
      {options.map(({ key, label, hint, icon: Icon }) => (
        <label key={key} className="settings-choice">
          <input
            type="radio"
            name="theme"
            value={key}
            checked={pref === key}
            onChange={() => setPref(key)}
          />
          <Icon aria-hidden="true" size={20} />
          <span>
            <strong>{label}</strong>
            <span>{hint}</span>
          </span>
          <Check className="settings-choice-check" aria-hidden="true" size={18} />
        </label>
      ))}
    </fieldset>
  );
}

/* Our space */

function SpacePane({ name, onSave }: Readonly<{ name: string; onSave: Props["onSaveSpace"] }>) {
  const { partner } = usePeople();
  const [n, setN] = useState(name);
  const [busy, run] = useSave();
  const changed = n.trim() !== name;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => onSave({ name: n.trim() }));
  };

  return (
    <form className="settings-form" onSubmit={submit}>
      <p className="settings-text">
        {partner ? `You and ${partner} both see it.` : "Your partner sees it once they join."}
      </p>
      <div className="field">
        <label htmlFor="set-space">Space name</label>
        <input id="set-space" value={n} maxLength={60} required onChange={(e) => setN(e.target.value)} />
      </div>
      <SaveButton busy={busy} disabled={!changed || !n.trim()} />
    </form>
  );
}

function PartnerPane({
  members,
  myUserId,
  onInvite,
}: Readonly<{ members: readonly ApiMember[]; myUserId: Props["myUserId"]; onInvite: Props["onInvite"] }>) {
  const { partner } = usePeople();
  const [invite, setInvite] = useState<{ code: string; daysLeft: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    setFailed(false);
    const inv = await onInvite();
    setBusy(false);
    if (!inv) return setFailed(true);
    const ms = new Date(inv.expiresAt).getTime() - Date.now();
    setInvite({ code: inv.code, daysLeft: Math.max(1, Math.ceil(ms / 86_400_000)) });
  };
  // Clipboard can be refused; the code stays on screen to copy by hand.
  const copy = (code: string) =>
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));

  const daysLeft = invite?.daysLeft ?? 0;

  return (
    <div className="settings-form">
      <ul className="settings-members">
        {members.map((m) => (
          <li key={m.userId}>
            <span
              className={`avatar ${m.role === "owner" ? "avatar-owner" : "avatar-partner"}`}
              aria-hidden="true"
            >
              {(m.displayName ?? "?").charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>
                {m.displayName ?? "No name yet"}
                {m.userId === myUserId && <span className="settings-you"> (you)</span>}
              </strong>
              <span>{m.role === "owner" ? "Started the space" : "Joined with an invite code"}</span>
            </span>
          </li>
        ))}
      </ul>

      {!partner && (
        <section className="settings-invite" aria-labelledby="invite-title">
          <h3 id="invite-title">Invite your partner</h3>
          <p className="settings-text">
            They sign in, choose “Join with an invite code” and enter the code.
          </p>
          {invite ? (
            <div className="settings-code">
              <span aria-label={invite.code.split("").join(" ")}>
                {invite.code.slice(0, 4)} {invite.code.slice(4)}
              </span>
              <button type="button" className="btn-secondary" onClick={() => void copy(invite.code)}>
                {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                {copied ? "Copied" : "Copy code"}
              </button>
              <p className="field-hint">
                Works once · expires in {daysLeft} {daysLeft === 1 ? "day" : "days"}
              </p>
            </div>
          ) : (
            <div>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void create()}>
                {busy ? "Creating…" : "Create an invite code"}
              </button>
            </div>
          )}
          {failed && (
            <p className="field-error" role="alert">
              Couldn't create a code. Check your connection and try again.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function CheckInsPane({ checkIn, onSave }: Readonly<{ checkIn: CheckInSchedule; onSave: Props["onSaveSpace"] }>) {
  const [every, setEvery] = useState<CheckInEvery>(checkIn.every);
  const [day, setDay] = useState(checkIn.day);
  const [busy, run] = useSave();
  const changed = every !== checkIn.every || day !== checkIn.day;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => onSave({ checkInEvery: every, checkInDay: day }));
  };

  return (
    <form className="settings-form" onSubmit={submit}>
      <p className="settings-text">A regular moment to look at your goals together.</p>
      <fieldset className="settings-choices">
        <legend className="field-label">How often?</legend>
        {frequencies.map((f) => (
          <label key={f.key} className="settings-choice">
            <input
              type="radio"
              name="every"
              value={f.key}
              checked={every === f.key}
              onChange={() => setEvery(f.key)}
            />
            <span>
              <strong>{f.label}</strong>
              <span>{f.hint}</span>
            </span>
            <Check className="settings-choice-check" aria-hidden="true" size={18} />
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="set-day">Which day?</label>
        <select id="set-day" value={day} onChange={(e) => setDay(e.target.value)}>
          {weekdays.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <SaveButton busy={busy} disabled={!changed} />
    </form>
  );
}
