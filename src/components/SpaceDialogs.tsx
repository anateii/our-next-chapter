import { forwardRef, useState } from "react";
import { CircleAlert, Trash, X } from "lucide-react";
import { usePeople } from "../helpers/people";
import type { Partner } from "../helpers/finances";
import {
  milestoneIcons,
  moods,
  statuses,
  type CheckInAnswer,
  type CheckInAnswers,
  type Milestone,
  type MilestoneIcon,
  type MilestoneStatus,
  type Mood,
} from "../helpers/ourspace";
import Avatars from "./Avatars";

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

function CloseButton({ dialog }: Readonly<{ dialog: React.ForwardedRef<HTMLDialogElement> }>) {
  return (
    <button type="button" className="icon-btn" aria-label="Close" onClick={() => closeRef(dialog)}>
      <X aria-hidden="true" size={20} />
    </button>
  );
}

// Delete, then "Yes, delete it" to confirm.
function DeleteButton({ label, onDelete }: Readonly<{ label: string; onDelete: () => void }>) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <button type="button" className="btn-danger sp-delete" onClick={onDelete}>
      <Trash aria-hidden="true" size={16} /> Yes, delete it
    </button>
  ) : (
    <button type="button" className="btn-ghost-danger sp-delete" onClick={() => setConfirming(true)}>
      <Trash aria-hidden="true" size={16} /> {label}
    </button>
  );
}

/* Milestone */

export type MilestoneFields = Omit<Milestone, "id">;

export const MilestoneDialog = forwardRef<
  HTMLDialogElement,
  {
    milestone: Milestone | null;
    onSave: (fields: MilestoneFields, id: string) => void;
    onDelete: (id: string) => void;
  }
>(function MilestoneDialog({ milestone, onSave, onDelete }, ref) {
  const [titleError, setTitleError] = useState(false);
  const [session, bump] = useSession();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!milestone) return;
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    setTitleError(!title);
    if (!title) {
      e.currentTarget.querySelector<HTMLElement>("#ms-title")?.focus();
      return;
    }
    onSave(
      {
        title,
        when: String(data.get("when") ?? "").trim() || undefined,
        icon: String(data.get("icon")) as MilestoneIcon,
        status: String(data.get("status")) as MilestoneStatus,
      },
      milestone.id,
    );
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog sp-dialog"
      aria-labelledby="ms-dialog-title"
      onClose={() => {
        setTitleError(false);
        bump();
      }}
    >
      {milestone && (
        <form key={`${milestone.id}-${session}`} onSubmit={submit} noValidate>
          <div className="dialog-head">
            <h2 id="ms-dialog-title">Edit milestone</h2>
            <CloseButton dialog={ref} />
          </div>
          <div className="field">
            <label htmlFor="ms-title">Milestone</label>
            <input
              id="ms-title"
              name="title"
              type="text"
              maxLength={60}
              autoComplete="off"
              defaultValue={milestone.title}
              aria-invalid={titleError || undefined}
              aria-describedby={titleError ? "ms-title-error" : undefined}
            />
            {titleError && <FieldError id="ms-title-error">Give the milestone a name.</FieldError>}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="ms-when">When</label>
              <input
                id="ms-when"
                name="when"
                type="text"
                maxLength={40}
                autoComplete="off"
                placeholder="e.g. Spring 2027"
                defaultValue={milestone.when}
              />
            </div>
            <div className="field">
              <label htmlFor="ms-status">Status</label>
              <select id="ms-status" name="status" defaultValue={milestone.status}>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <fieldset className="sp-icons">
            <legend>Icon</legend>
            <div>
              {milestoneIcons.map(({ key, label, icon: Icon }) => (
                <label key={key} className="sp-icon-choice">
                  <input type="radio" name="icon" value={key} defaultChecked={milestone.icon === key} />
                  <span>
                    <Icon aria-hidden="true" size={20} />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dialog-actions">
            <DeleteButton
              label="Delete"
              onDelete={() => {
                onDelete(milestone.id);
                closeRef(ref);
              }}
            />
            <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
});

/* Weekly check-in: how the week felt, then three questions. Both of you
   answer on the same screen. A closed check-in keeps its answers until it's
   finished. */

const ciSteps = [
  { key: "mood", q: "How did this week feel?", hint: "One each. There are no wrong answers." },
  { key: "good", q: "What went well?", hint: "Something you're glad about, big or small." },
  { key: "hard", q: "What was hard?", hint: "Say it kindly. You're on the same team." },
  { key: "next", q: "What's one thing for next week?", hint: "Something you'll do together." },
] as const;
type Draft = Partial<Record<Partner, Partial<CheckInAnswer>>>;

export const CheckInDialog = forwardRef<
  HTMLDialogElement,
  { onSave: (answers: CheckInAnswers) => void }
>(function CheckInDialog({ onSave }, ref) {
  const { name, partner } = usePeople();
  const people: Partner[] = partner ? ["owner", "partner"] : ["owner"];
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [moodError, setMoodError] = useState(false);
  const s = ciSteps[step];
  const last = step === ciSteps.length - 1;

  const set = (p: Partner, field: keyof CheckInAnswer, value: string) =>
    setDraft((d) => ({ ...d, [p]: { ...d[p], [field]: value } }));

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 0 && !people.some((p) => draft[p]?.mood)) {
      setMoodError(true);
      return;
    }
    setMoodError(false);
    if (!last) {
      setStep(step + 1);
      return;
    }
    // Only people who picked a mood took part.
    const answers: CheckInAnswers = {};
    for (const p of people) {
      const a = draft[p];
      if (a?.mood)
        answers[p] = { mood: a.mood as Mood, good: a.good?.trim() ?? "", hard: a.hard?.trim() ?? "", next: a.next?.trim() ?? "" };
    }
    onSave(answers);
    setDraft({});
    setStep(0);
    closeRef(ref);
  };

  return (
    <dialog ref={ref} className="dialog sp-dialog sp-checkin" aria-labelledby="ci-dialog-title">
      <form onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="ci-dialog-title">Weekly check-in</h2>
          <CloseButton dialog={ref} />
        </div>
        <div className="sp-progress">
          <span>
            Step {step + 1} of {ciSteps.length}
          </span>
          <div aria-hidden="true">
            {ciSteps.map((x, i) => (
              <i key={x.key} className={i <= step ? "on" : ""} />
            ))}
          </div>
        </div>
        <div>
          <p className="sp-prompt">{s.q}</p>
          <p className="sp-prompt-hint">{s.hint}</p>
        </div>
        <div className="sp-answers">
          {people.map((p) =>
            s.key === "mood" ? (
              <fieldset key={p} className="sp-moods" aria-describedby={moodError ? "ci-mood-error" : undefined}>
                <legend>
                  <Avatars owner={p} /> {name(p)}
                </legend>
                <div>
                  {moods.map((m) => (
                    <label key={m}>
                      <input
                        type="radio"
                        name={`mood-${p}`}
                        value={m}
                        checked={draft[p]?.mood === m}
                        onChange={() => set(p, "mood", m)}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div key={p} className="field">
                <label htmlFor={`ci-${s.key}-${p}`} className="sp-answer-label">
                  <Avatars owner={p} /> {name(p)}
                </label>
                <textarea
                  id={`ci-${s.key}-${p}`}
                  rows={3}
                  maxLength={300}
                  value={draft[p]?.[s.key] ?? ""}
                  onChange={(e) => set(p, s.key, e.target.value)}
                  disabled={!draft[p]?.mood}
                  placeholder={draft[p]?.mood ? "Optional" : `${name(p)} skipped the mood, so they're sitting this one out`}
                />
              </div>
            ),
          )}
          {moodError && <FieldError id="ci-mood-error">Pick a mood for at least one of you.</FieldError>}
        </div>
        <div className="dialog-actions">
          {step > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button type="submit" className="btn-primary">
            {last ? "Finish check-in" : "Next"}
          </button>
        </div>
      </form>
    </dialog>
  );
});
