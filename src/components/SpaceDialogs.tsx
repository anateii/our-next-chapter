import { forwardRef, useState } from "react";
import { usePeople } from "../helpers/people";
import type { Partner } from "../helpers/finances";
import { moods, type CheckInAnswer, type CheckInAnswers, type Mood } from "../helpers/ourspace";
import Avatars from "./Avatars";
import { CloseButton, FieldError } from "./dialogParts";
import { closeRef } from "../helpers/dialogs";

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
