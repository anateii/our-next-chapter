import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  KeyRound,
  LoaderCircle,
  Plus,
  Share,
} from "lucide-react";
import { useApi } from "../helpers/api";
import { FieldError } from "../components/dialogParts";
import {
  frequencies,
  nextCheckIn,
  weekdays,
  type CheckInEvery,
} from "../helpers/checkins";
import "./Onboarding.css";

type Step =
  | "welcome"
  | "create"
  | "checkin"
  | "invite"
  | "join"
  | "done";
// Starting a space: these steps, in order, with "Step n of 3".
const createSteps: Step[] = ["create", "checkin", "invite"];
const stepOf = (s: Step) =>
  `Step ${createSteps.indexOf(s) + 1} of ${createSteps.length}`;

const longDay = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});
type Invite = { code: string; expiresAt: string; daysLeft: number };

// API error messages (api/join.ts) -> what to tell the person.
const joinErrors: Record<string, string> = {
  "Invalid code":
    "We couldn't find that code. Check it with your partner and try again.",
  "Code expired":
    "This code has expired. Ask your partner to create a new invite.",
  "Code already used":
    "This code was already used. Ask your partner for a new one.",
};

const CODE_LENGTH = 8;
const tidyCode = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);


// Preview mode (dev only, see App.tsx) answers requests locally so every
// screen can be clicked through without creating anything.
const fakeResponse = (init?: RequestInit) =>
  String(init?.body ?? "").includes('"invite"')
    ? {
        code: "PREVIEW1",
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      }
    : {};

// First-run flow for someone without a space: start one (and invite a
// partner) or join a partner's space with an invite code.
export default function Onboarding({
  onDone,
  preview = false,
}: Readonly<{ onDone: () => void; preview?: boolean }>) {
  const realApi = useApi();
  const api = <T,>(path: string, init?: RequestInit): Promise<T> =>
    preview
      ? new Promise((resolve) =>
          setTimeout(() => resolve(fakeResponse(init) as T), 700),
        )
      : realApi<T>(path, init);
  const { user } = useUser();
  const { signOut } = useClerk();

  const [step, setStep] = useState<Step>("welcome");
  const [path, setPath] = useState<"create" | "join">("create");
  const [name, setName] = useState(user?.firstName ?? "");
  const [spaceName, setSpaceName] = useState("");
  const [code, setCode] = useState("");
  const [nameError, setNameError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteFailed, setInviteFailed] = useState(false);
  const [copied, setCopied] = useState<"" | "code" | "message">("");
  // What the new space starts with: its check-in schedule.
  const [every, setEvery] = useState<CheckInEvery>("weekly");
  const [checkInDay, setCheckInDay] = useState("Sunday");

  const trimmedName = name.trim();
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Each step is a new "screen": move focus to its heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goTo = (next: Step) => {
    setNameError("");
    setCodeError("");
    setFormError("");
    setStep(next);
  };

  const requireName = (message: string) => {
    if (trimmedName) return true;
    setNameError(message);
    nameRef.current?.focus();
    return false;
  };

  const createInvite = () => {
    setInvite(null);
    setInviteFailed(false);
    api<Omit<Invite, "daysLeft">>("/space", {
      method: "POST",
      body: JSON.stringify({ action: "invite" }),
    })
      .then((inv) =>
        setInvite({
          ...inv,
          daysLeft: Math.max(
            1,
            Math.round((Date.parse(inv.expiresAt) - Date.now()) / 86_400_000),
          ),
        }),
      )
      .catch(() => setInviteFailed(true));
  };

  // Step 1 only checks the name; the space is created after the check-in step.
  const submitName = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !requireName("Add your name so your partner knows who started the space.")
    )
      return;
    goTo("checkin");
  };

  // Creates the space with everything from the steps before, in one request.
  const submitCreate = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api("/space", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          name: spaceName.trim() || `${trimmedName} & partner`,
          displayName: trimmedName,
          checkInDay,
          checkInEvery: every,
        }),
      });
      goTo("invite");
      createInvite();
    } catch (err) {
      if ((err as Error).message === "You already have a space")
        return onDone();
      setFormError(
        "We couldn't create your space. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nameOk = requireName(
      "Add your name so your partner sees who joined.",
    );
    if (code.length !== CODE_LENGTH) {
      setCodeError(`Enter all ${CODE_LENGTH} characters of the code.`);
      if (nameOk) codeRef.current?.focus();
      return;
    }
    if (!nameOk) return;
    setBusy(true);
    setFormError("");
    try {
      await api("/space", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          code,
          displayName: trimmedName,
        }),
      });
      goTo("done");
    } catch (err) {
      const message = (err as Error).message;
      if (message === "You already have a space") return onDone();
      if (joinErrors[message]) {
        setCodeError(joinErrors[message]);
        codeRef.current?.focus();
      } else {
        setFormError(
          "We couldn't join right now. Check your connection and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // Clipboard can be refused (permissions, insecure context): then the code
  // stays on screen to type or copy by hand, so the failure is silent.
  const copy = (text: string, what: "code" | "message") =>
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(what);
        setTimeout(() => setCopied(""), 2000);
      })
      .catch(() => setCopied(""));

  // Phones get the system share sheet; elsewhere the message is copied.
  const share = async (inv: Invite) => {
    const text = `Join me on Ourly! Sign in, choose "Join with an invite code" and enter ${inv.code}.`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Ourly",
          text,
          url: globalThis.location.origin,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // they closed the sheet
      }
    }
    copy(`${text} ${globalThis.location.origin}`, "message");
  };

  const backButton = (to: Step = "welcome") => (
    <button
      type="button"
      className="icon-btn ob-back"
      aria-label="Back"
      onClick={() => goTo(to)}
    >
      <ArrowLeft aria-hidden="true" size={20} />
    </button>
  );
  const firstCheckIn = nextCheckIn(
    { day: checkInDay, every, since: new Date() },
    [],
  );

  const submitButton = (label: string, busyLabel: string) => (
    <button
      type="submit"
      className="btn-primary ob-cta"
      disabled={busy}
      aria-busy={busy}
    >
      {busy && <LoaderCircle className="spin" aria-hidden="true" size={18} />}
      {busy ? busyLabel : label}
    </button>
  );

  const formAlert = formError && (
    <p className="ob-alert" role="alert">
      <CircleAlert aria-hidden="true" size={18} />
      {formError}
    </p>
  );

  let screen;
  if (step === "welcome") {
    screen = (
      <div className="ob-step">
        <div className="ob-intro ob-intro-welcome">
          <h1 ref={headingRef} tabIndex={-1}>
            Let's set up your shared space
          </h1>
          <p>
            Goals, tasks and your countdown all live in one space the two of you
            share.
          </p>
        </div>
        <div className="ob-choices">
          <button
            type="button"
            className="ob-choice"
            onClick={() => {
              setPath("create");
              goTo("create");
            }}
          >
            <span className="stat-icon tint-accent" aria-hidden="true">
              <Plus size={22} strokeWidth={2.2} />
            </span>
            <span className="ob-choice-text">
              <strong>Start our space</strong>
              <span>I'm setting things up first</span>
            </span>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            className="ob-choice"
            onClick={() => {
              setPath("join");
              goTo("join");
            }}
          >
            <span className="stat-icon tint-sage" aria-hidden="true">
              <KeyRound size={22} />
            </span>
            <span className="ob-choice-text">
              <strong>Join with an invite code</strong>
              <span>My partner already started one</span>
            </span>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
        <p className="ob-signed-in">
          Signed in as {user?.primaryEmailAddress?.emailAddress ?? "you"} ·{" "}
          <button type="button" className="ob-link" onClick={() => signOut()}>
            Not you?
          </button>
        </p>
      </div>
    );
  } else if (step === "create") {
    screen = (
      <form className="ob-step" onSubmit={submitName} noValidate>
        <div className="ob-top">
          {backButton()}
          <span className="ob-progress">{stepOf("create")}</span>
        </div>
        <div className="ob-intro">
          <h1 ref={headingRef} tabIndex={-1}>
            Name your space
          </h1>
          <p>You can change these later in Settings.</p>
        </div>
        <div className="field">
          <label htmlFor="ob-name">Your name</label>
          <input
            ref={nameRef}
            id="ob-name"
            type="text"
            autoComplete="given-name"
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError("");
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={
              nameError ? "ob-name-error ob-name-hint" : "ob-name-hint"
            }
          />
          {nameError && <FieldError id="ob-name-error">{nameError}</FieldError>}
          <p id="ob-name-hint" className="field-hint">
            This is how you'll show up on goals and tasks.
          </p>
        </div>
        <div className="field">
          <label htmlFor="ob-space">Space name</label>
          <input
            id="ob-space"
            type="text"
            autoComplete="off"
            maxLength={60}
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder={
              trimmedName ? `${trimmedName} & partner` : "Sam & Alex"
            }
            aria-describedby="ob-space-hint"
          />
          <p id="ob-space-hint" className="field-hint">
            Optional. Leave it empty to use the suggestion.
          </p>
        </div>
        <div className="ob-actions">
          <button type="submit" className="btn-primary ob-cta">
            Continue
          </button>
        </div>
      </form>
    );
  } else if (step === "checkin") {
    screen = (
      <form className="ob-step" onSubmit={submitCreate} noValidate>
        <div className="ob-top">
          {backButton("create")}
          <span className="ob-progress">{stepOf("checkin")}</span>
        </div>
        <div className="ob-intro">
          <h1 ref={headingRef} tabIndex={-1}>
            Make time to check in
          </h1>
          <p>
            A few minutes together: how it went, what was hard, and one thing
            for next time. It goes on your calendar.
          </p>
        </div>

        <fieldset className="ob-fieldset">
          <legend>How often?</legend>
          <div className="ob-options">
            {frequencies.map((f) => (
              <label key={f.key} className="ob-option">
                <input
                  type="radio"
                  name="every"
                  value={f.key}
                  checked={every === f.key}
                  onChange={() => setEvery(f.key)}
                />
                <span className="ob-option-box">
                  <span className="ob-radio" aria-hidden="true" />
                  <span className="ob-option-text">
                    <strong>
                      {f.label}
                      {f.recommended && (
                        <span className="ob-recommended">Recommended</span>
                      )}
                    </strong>
                    <span>
                      {f.key === "monthly"
                        ? `The first ${checkInDay} of each month`
                        : f.hint}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="ob-day">Which day?</label>
          <select
            id="ob-day"
            value={checkInDay}
            onChange={(e) => setCheckInDay(e.target.value)}
          >
            {weekdays.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <p className="field-hint" aria-live="polite">
            {firstCheckIn
              ? `Your first one: ${longDay.format(firstCheckIn.day)}, all day.`
              : ""}
          </p>
        </div>

        <div className="ob-actions">
          {formAlert}
          {submitButton("Create our space", "Creating your space…")}
        </div>
      </form>
    );
  } else if (step === "invite") {
    screen = (
      <div className="ob-step">
        <div className="ob-top ob-top-end">
          <span className="ob-progress">{stepOf("invite")}</span>
        </div>
        <div className="ob-intro">
          <span className="stat-icon tint-sage ob-badge" aria-hidden="true">
            <Check size={24} strokeWidth={2.4} />
          </span>
          <h1 ref={headingRef} tabIndex={-1}>
            Your space is ready
          </h1>
          <p>
            Now invite your partner. They sign in, choose “Join with an invite
            code” and enter this code.
          </p>
        </div>

        <div className="card ob-code-card">
          <span className="ob-code-label">Invite code</span>
          {invite && (
            <>
              <div className="ob-code-row">
                <span
                  className="ob-code"
                  aria-label={invite.code.split("").join(" ")}
                >
                  {invite.code.slice(0, 4)} {invite.code.slice(4)}
                </span>
                <button
                  type="button"
                  className="btn-secondary ob-copy"
                  onClick={() => copy(invite.code, "code")}
                >
                  {copied === "code" ? (
                    <Check aria-hidden="true" size={16} strokeWidth={2.4} />
                  ) : (
                    <Copy aria-hidden="true" size={16} />
                  )}
                  {copied === "code" ? "Copied" : "Copy"}
                </button>
              </div>
              <span className="field-hint">
                Works once · expires in {invite.daysLeft}{" "}
                {invite.daysLeft === 1 ? "day" : "days"}
              </span>
            </>
          )}
          {!invite && !inviteFailed && (
            <p className="ob-code-loading" role="status">
              <LoaderCircle className="spin" aria-hidden="true" size={18} />{" "}
              Creating a code…
            </p>
          )}
          {inviteFailed && (
            <div className="ob-code-failed" role="alert">
              <p>We couldn't create an invite code.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={createInvite}
              >
                Try again
              </button>
            </div>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {copied === "code" && "Invite code copied"}
          {copied === "message" && "Invite message copied"}
        </p>

        <div className="ob-actions">
          <button
            type="button"
            className="btn-primary ob-cta"
            disabled={!invite}
            onClick={() => invite && share(invite)}
          >
            {copied === "message" ? (
              <Check aria-hidden="true" size={18} strokeWidth={2.4} />
            ) : (
              <Share aria-hidden="true" size={18} />
            )}
            {copied === "message" ? "Invite copied" : "Share invite"}
          </button>
          <button
            type="button"
            className="ob-skip"
            onClick={() => goTo("done")}
          >
            I'll invite them later
          </button>
        </div>
      </div>
    );
  } else if (step === "join") {
    screen = (
      <form className="ob-step" onSubmit={submitJoin} noValidate>
        <div className="ob-top">{backButton()}</div>
        <div className="ob-intro">
          <h1 ref={headingRef} tabIndex={-1}>
            Join your partner's space
          </h1>
          <p>
            Ask them for the {CODE_LENGTH}-character code from their invite.
          </p>
        </div>
        <div className="field">
          <label htmlFor="ob-name">Your name</label>
          <input
            ref={nameRef}
            id="ob-name"
            type="text"
            autoComplete="given-name"
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError("");
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "ob-name-error" : undefined}
          />
          {nameError && <FieldError id="ob-name-error">{nameError}</FieldError>}
        </div>
        <div className="field">
          <label htmlFor="ob-code">Invite code</label>
          <input
            ref={codeRef}
            id="ob-code"
            className="ob-code-input"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => {
              setCode(tidyCode(e.target.value));
              setCodeError("");
            }}
            placeholder="3F9A1C2B"
            aria-invalid={codeError ? true : undefined}
            aria-describedby={
              codeError ? "ob-code-error ob-code-hint" : "ob-code-hint"
            }
          />
          {codeError && <FieldError id="ob-code-error">{codeError}</FieldError>}
          <p id="ob-code-hint" className="field-hint">
            Letters and numbers only. Capitals are added for you.
          </p>
        </div>
        <div className="ob-actions">
          {formAlert}
          {submitButton("Join space", "Joining…")}
        </div>
      </form>
    );
  } else {
    screen = (
      <div className="ob-step">
        <div className="ob-done">
          <span className="stat-icon tint-sage" aria-hidden="true">
            <Check size={34} strokeWidth={2.4} />
          </span>
          <h1 ref={headingRef} tabIndex={-1}>
            {path === "join"
              ? `You're in, ${trimmedName}!`
              : `All set, ${trimmedName}!`}
          </h1>
          <p>
            {path === "join"
              ? "You now share goals, tasks and the countdown with your partner."
              : "Your check-ins are waiting in Our Space. Your partner can join any time with the code."}
          </p>
        </div>
        <div className="ob-actions">
          <button
            type="button"
            className="btn-primary ob-cta"
            onClick={() => {
              // Someone who started the space lands on what they just set up.
              if (path === "create") globalThis.location.hash = "#space";
              onDone();
            }}
          >
            {path === "create" ? "Go to Our Space" : "Go to Home"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="ob-brand">
        {/* One per theme; CSS shows the one that matches [data-theme] */}
        <img className="brand-light" src="/ourly-logo-sidebar.png" alt="Ourly" width={404} height={120} />
        <img className="brand-dark" src="/ourly-logo-dark-sidebar.png" alt="Ourly" width={404} height={120} />
      </div>
      <main id="main" className="ob-card">
        {screen}
      </main>
    </div>
  );
}
