import { forwardRef, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, Trash, X } from "lucide-react";
import { usePeople } from "../helpers/people";
import type { Partner } from "../helpers/finances";
import {
  moods,
  statusSlug,
  statuses,
  type CheckInAnswer,
  type CheckInAnswers,
  type Milestone,
  type MilestoneStatus,
  type Mood,
} from "../helpers/ourspace";
import Avatars from "./Avatars";
import EmojiPicker, { MilestoneMark } from "./EmojiPicker";

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

/* Add a milestone */

export type MilestoneFields = Omit<Milestone, "id">;

export const AddMilestoneDialog = forwardRef<
  HTMLDialogElement,
  { onAdd: (fields: MilestoneFields) => void }
>(function AddMilestoneDialog({ onAdd }, ref) {
  const [titleError, setTitleError] = useState(false);
  const [emoji, setEmoji] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  const [session, bump] = useSession();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    setTitleError(!title);
    if (!title) {
      e.currentTarget.querySelector<HTMLElement>("#ms-title")?.focus();
      return;
    }
    onAdd({
      title,
      when: String(data.get("when") ?? "").trim() || undefined,
      icon: "star", // shown only if no emoji is picked
      emoji,
      status: String(data.get("status")) as MilestoneStatus,
    });
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog sp-dialog"
      aria-labelledby="ms-dialog-title"
      onClose={() => {
        setTitleError(false);
        setEmoji(undefined);
        setPicking(false);
        bump();
      }}
    >
      <form key={session} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="ms-dialog-title">Add milestone</h2>
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
            placeholder="e.g. Adopt a dog"
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? "ms-title-error" : undefined}
          />
          {titleError && <FieldError id="ms-title-error">Give the milestone a name.</FieldError>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="ms-when">When</label>
            <input id="ms-when" name="when" type="text" maxLength={40} autoComplete="off" placeholder="e.g. Spring 2027" />
          </div>
          <div className="field">
            <label htmlFor="ms-status">Status</label>
            <select id="ms-status" name="status" defaultValue="Planning">
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <span className="sp-label" id="ms-emoji-label">
            Emoji <span className="sp-optional">(optional)</span>
          </span>
          <div className="sp-emoji-row">
            <button
              type="button"
              className="sp-rm-icon"
              aria-labelledby="ms-emoji-label ms-emoji-value"
              aria-expanded={picking}
              aria-controls="ms-emoji-picker"
              onClick={() => setPicking((p) => !p)}
            >
              <MilestoneMark emoji={emoji} icon="star" size={18} />
            </button>
            <span id="ms-emoji-value" className="field-hint">
              {emoji ? "Tap to change it" : "Tap to pick one, or keep the star"}
            </span>
          </div>
          {picking && (
            <div id="ms-emoji-picker">
              <EmojiPicker
                onPick={(e) => {
                  setEmoji(e);
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
                onClear={
                  emoji
                    ? () => {
                        setEmoji(undefined);
                        setPicking(false);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Add milestone
          </button>
        </div>
      </form>
    </dialog>
  );
});

/* Edit the whole roadmap: rename, when, icon, status, order, delete.
   Nothing is saved until Save, so Cancel undoes everything. */

export type RoadmapRow = Pick<Milestone, "id" | "title" | "icon" | "emoji" | "status"> & { when: string };

export const RoadmapDialog = forwardRef<
  HTMLDialogElement,
  {
    milestones: readonly Milestone[];
    // Bumped each time the dialog opens: the form then copies the roadmap as
    // it is right now, and keeps that copy while open (background refreshes
    // don't reset what you're editing).
    openKey: number;
    onSave: (rows: RoadmapRow[], deleted: string[]) => void;
  }
>(function RoadmapDialog({ milestones, openKey, onSave }, ref) {
  return (
    <dialog ref={ref} className="dialog sp-dialog sp-roadmap-dialog" aria-labelledby="rm-dialog-title">
      <RoadmapForm key={openKey} milestones={milestones} onSave={onSave} dialog={ref} />
    </dialog>
  );
});

function RoadmapForm({
  milestones,
  onSave,
  dialog,
}: Readonly<{
  milestones: readonly Milestone[];
  onSave: (rows: RoadmapRow[], deleted: string[]) => void;
  dialog: React.ForwardedRef<HTMLDialogElement>;
}>) {
  // The roadmap as it was when the dialog opened.
  const [initial] = useState<RoadmapRow[]>(() =>
    milestones.map((m) => ({ id: m.id, title: m.title, icon: m.icon, emoji: m.emoji, status: m.status, when: m.when ?? "" })),
  );
  const [rows, setRows] = useState<RoadmapRow[]>(initial);
  const [errors, setErrors] = useState<ReadonlySet<string>>(new Set());
  // The milestone whose emoji picker is open (one at a time).
  const [picking, setPicking] = useState<string | null>(null);
  // Close the picker and put focus back on that milestone's icon button.
  const closePicker = (id: string) => {
    setPicking(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-controls="rm-icons-${id}"]`)?.focus());
  };
  // Deleted here = shown when the dialog opened, and removed since.
  const deleted = initial.filter((m) => !rows.some((r) => r.id === m.id)).map((m) => m.id);
  const removed = deleted.length;

  const set = (id: string, patch: Partial<RoadmapRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (i: number, by: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const empty = new Set(rows.filter((r) => !r.title.trim()).map((r) => r.id));
    setErrors(empty);
    if (empty.size) {
      e.currentTarget.querySelector<HTMLElement>(`#rm-title-${[...empty][0]}`)?.focus();
      return;
    }
    onSave(
      rows.map((r) => ({ ...r, title: r.title.trim(), when: r.when.trim() })),
      deleted,
    );
    closeRef(dialog);
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="dialog-head">
        <h2 id="rm-dialog-title">Edit roadmap</h2>
        <CloseButton dialog={dialog} />
      </div>
      {rows.length === 0 ? (
        <p className="empty">No milestones left. Save to clear the roadmap, or Cancel to keep them.</p>
      ) : (
        <ol className="sp-rm-list">
          {rows.map((r, i) => {
            const bad = errors.has(r.id);
            const open = picking === r.id;
            return (
              <li key={r.id}>
                <div className="sp-rm-top">
                  <button
                    type="button"
                    className="sp-rm-icon"
                    aria-label={`${r.emoji ? `Emoji: ${r.emoji}` : "No emoji yet"}. Choose an emoji for ${r.title || "this milestone"}`}
                    aria-expanded={open}
                    aria-controls={`rm-icons-${r.id}`}
                    onClick={() => setPicking(open ? null : r.id)}
                  >
                    <MilestoneMark emoji={r.emoji} icon={r.icon} size={18} />
                  </button>
                  <label className="sr-only" htmlFor={`rm-title-${r.id}`}>
                    Milestone {i + 1}
                  </label>
                  <input
                    id={`rm-title-${r.id}`}
                    className="sp-rm-title"
                    type="text"
                    maxLength={60}
                    autoComplete="off"
                    value={r.title}
                    onChange={(e) => set(r.id, { title: e.target.value })}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? `rm-title-${r.id}-error` : undefined}
                  />
                  <div className="sp-rm-tools">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${r.title || "milestone"} earlier`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp aria-hidden="true" size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${r.title || "milestone"} later`}
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown aria-hidden="true" size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn sp-rm-delete"
                      aria-label={`Delete ${r.title || "milestone"}`}
                      onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    >
                      <Trash aria-hidden="true" size={17} />
                    </button>
                  </div>
                </div>
                {bad && <FieldError id={`rm-title-${r.id}-error`}>Give it a name, or delete it.</FieldError>}
                {open && (
                  <div id={`rm-icons-${r.id}`} className="sp-rm-icons">
                    <EmojiPicker
                      onPick={(emoji) => {
                        set(r.id, { emoji });
                        closePicker(r.id);
                      }}
                      onClose={() => closePicker(r.id)}
                      onClear={
                        r.emoji
                          ? () => {
                              set(r.id, { emoji: undefined });
                              closePicker(r.id);
                            }
                          : undefined
                      }
                    />
                  </div>
                )}
                <div className="sp-rm-bottom">
                  <label className="sr-only" htmlFor={`rm-when-${r.id}`}>
                    When, for {r.title}
                  </label>
                  <input
                    id={`rm-when-${r.id}`}
                    type="text"
                    maxLength={40}
                    autoComplete="off"
                    placeholder="When? (optional)"
                    value={r.when}
                    onChange={(e) => set(r.id, { when: e.target.value })}
                  />
                </div>
                <fieldset className="sp-rm-status">
                  <legend className="sr-only">Status of {r.title || "this milestone"}</legend>
                  {statuses.map((st) => (
                    <label key={st}>
                      <input
                        type="radio"
                        name={`rm-status-${r.id}`}
                        value={st}
                        checked={r.status === st}
                        onChange={() => set(r.id, { status: st })}
                      />
                      <span className={`status-${statusSlug(st)}`}>{st}</span>
                    </label>
                  ))}
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}
      {removed > 0 && (
        <p className="field-hint" aria-live="polite">
          {removed === 1 ? "1 milestone will be deleted" : `${removed} milestones will be deleted`} when you save.
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn-secondary" onClick={() => closeRef(dialog)}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Save roadmap
        </button>
      </div>
    </form>
  );
}

/* Check-in: how the week felt, then three questions. Both of you
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
  { title: string; onSave: (answers: CheckInAnswers) => void }
>(function CheckInDialog({ title, onSave }, ref) {
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
          <h2 id="ci-dialog-title">{title}</h2>
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
