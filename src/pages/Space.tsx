import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, Heart, MessagesSquare, Pencil } from "lucide-react";
import type { Person } from "../types";
import type { ApiMember } from "../helpers/goals";
import type { Partner } from "../helpers/finances";
import { usePeople } from "../helpers/people";
import { checkInTitle, nextCheckIn, scheduleLabel, type CheckInSchedule } from "../helpers/checkins";
import {
  daysUntil,
  fromApiOurSpace,
  iconOf,
  moods,
  statuses,
  type ApiOurSpace,
  type CheckIn,
  type CheckInAnswers,
  type Milestone,
  type MilestoneStatus,
  type OurSpace,
  type Win,
} from "../helpers/ourspace";
import Avatars from "../components/Avatars";
import { CheckInDialog, MilestoneDialog, type MilestoneFields } from "../components/SpaceDialogs";
import "./Space.css";

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type Notify = (t: { message: string; ok: boolean; undo?: () => void }) => void;

// How long an Undo toast stays up; deletes wait this long before reaching the API.
const UNDO_MS = 5000;
const HISTORY_SHOWN = 3;

const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const longDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const isTemp = (id: string) => id.startsWith("new-");
const tempId = () => `new-${crypto.randomUUID()}`;

export default function Space({
  data,
  setData,
  api,
  notify,
  me: viewer,
  members,
  focus,
  onFocus,
  checkIn,
  countdown,
}: Readonly<{
  data: OurSpace;
  setData: React.Dispatch<React.SetStateAction<OurSpace>>;
  api: Api;
  notify: Notify;
  me: Person;
  members: readonly ApiMember[];
  focus: string;
  onFocus: (focus: string) => void;
  checkIn: CheckInSchedule;
  countdown?: { title: string; targetDate: string }; // the featured goal, if it has a date
}>) {
  const { name, partner } = usePeople();
  const me: Partner = viewer === "partner" ? "partner" : "owner";
  const other: Partner = me === "owner" ? "partner" : "owner";

  /* Saving: show at once, save in the background, then take what the server has. */
  const reload = () =>
    api<ApiOurSpace>("/ourspace")
      .then((s) => setData(fromApiOurSpace(s, members)))
      .catch((err) => console.warn("Reloading Our Space failed:", err));
  const failed = (what: string) => (err: unknown) => {
    console.error(`${what} failed:`, err);
    notify({ message: `Couldn't ${what.toLowerCase()}. Try again.`, ok: false });
    void reload();
  };
  const write = <T,>(method: string, body?: unknown, query = "") =>
    api<T>(`/ourspace${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const patch = (type: string, id: string, fields: Record<string, unknown>, what: string) =>
    write("PATCH", { type, id, ...fields }).then(reload, failed(what));
  const patchSpace = (fields: Record<string, unknown>, what: string) =>
    write("PATCH", { type: "space", ...fields }).catch(failed(what));

  // Deletes are hidden at once and sent after the Undo window.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const unhide = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      next.delete(id);
      return next;
    });
  const removeLater = (type: string, id: string, message: string) => {
    setHidden((h) => new Set(h).add(id));
    const timer = setTimeout(() => {
      write("DELETE", undefined, `?type=${type}&id=${encodeURIComponent(id)}`)
        .then(reload, failed(`Delete the ${type}`))
        .finally(() => unhide(id));
    }, UNDO_MS);
    notify({
      message,
      ok: true,
      undo: () => {
        clearTimeout(timer);
        unhide(id);
      },
    });
  };
  const shown = <T extends { id: string }>(list: readonly T[]) => list.filter((x) => !hidden.has(x.id));

  const milestones = shown(data.milestones);
  const wins = shown(data.wins);
  const checkins = shown(data.checkins);

  /* Dialogs */
  const milestoneRef = useRef<HTMLDialogElement>(null);
  const checkInRef = useRef<HTMLDialogElement>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const openMilestone = (m: Milestone) => {
    flushSync(() => setEditingMilestone(m));
    milestoneRef.current?.showModal();
  };

  /* Focus */
  const [editingFocus, setEditingFocus] = useState(false);
  const saveFocus = (value: string) => {
    setEditingFocus(false);
    const before = focus;
    const next = value.trim();
    if (next === before) return;
    onFocus(next);
    void patchSpace({ focus: next }, "Save your focus").then((ok) => ok === undefined && onFocus(before));
    notify({
      message: "Focus updated",
      ok: true,
      undo: () => {
        onFocus(before);
        void patchSpace({ focus: before }, "Undo");
      },
    });
  };

  /* Roadmap */
  const setMilestones = (fn: (ms: Milestone[]) => Milestone[]) =>
    setData((d) => ({ ...d, milestones: fn(d.milestones) }));
  const addMilestone = (title: string) => {
    setMilestones((ms) => [...ms, { id: tempId(), title, icon: "star", status: "Planning" }]);
    write("POST", { type: "milestone", title }).then(reload, failed("Add the milestone"));
    notify({ message: `Added “${title}” to the roadmap`, ok: true });
  };
  const editMilestone = (fields: Partial<MilestoneFields>, id: string, what = "Save the milestone") => {
    setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, ...fields } : m)));
    const body: Record<string, unknown> = { ...fields };
    if ("when" in fields) body.when = fields.when ?? null;
    return patch("milestone", id, body, what);
  };
  const setStatus = (m: Milestone, status: MilestoneStatus) => {
    void editMilestone({ status }, m.id, "Change the status");
    notify({
      message: status === "Done" ? `${m.title}: done!` : `${m.title}: ${status.toLowerCase()}`,
      ok: true,
      undo: () => void editMilestone({ status: m.status }, m.id, "Undo"),
    });
  };

  /* Check-ins */
  const saveCheckIn = (answers: CheckInAnswers) => {
    const temp: CheckIn = { id: tempId(), answers, at: new Date().toISOString() };
    setData((s) => ({ ...s, checkins: [temp, ...s.checkins] }));
    const saved = write<{ checkin: { id: string } }>("POST", { type: "checkin", answers })
      .then((res) => {
        void reload();
        return res.checkin.id;
      })
      .catch((err) => {
        failed("Save the check-in")(err);
        return null;
      });
    notify({
      message: "Check-in saved. See you next time.",
      ok: true,
      undo: () => {
        setData((s) => ({ ...s, checkins: s.checkins.filter((c) => c.id !== temp.id) }));
        void saved.then((id) => {
          if (id) write("DELETE", undefined, `?type=checkin&id=${encodeURIComponent(id)}`).then(reload, failed("Undo"));
        });
      },
    });
  };
  const next = nextCheckIn(
    checkIn,
    checkins.map((c) => c.at),
  ) ?? { day: new Date(), inDays: 0, done: false };
  const whenLabel = (() => {
    if (next.inDays === 0) return "Today";
    if (next.inDays === 1) return "Tomorrow";
    return longDay.format(next.day);
  })();
  const [allHistory, setAllHistory] = useState(false);

  /* Wins */
  const addWin = (text: string) => {
    const temp: Win = { id: tempId(), text, who: me, cheers: [], at: new Date().toISOString() };
    setData((s) => ({ ...s, wins: [temp, ...s.wins] }));
    const saved = write<{ win: { id: string } }>("POST", { type: "win", text })
      .then((res) => {
        void reload();
        return res.win.id;
      })
      .catch((err) => {
        failed("Add the win")(err);
        return null;
      });
    notify({
      message: partner ? `Win added. ${name(other)} will see it in Recent activity.` : "Win added",
      ok: true,
      undo: () => {
        setData((s) => ({ ...s, wins: s.wins.filter((w) => w.id !== temp.id) }));
        void saved.then((id) => {
          if (id) write("DELETE", undefined, `?type=win&id=${encodeURIComponent(id)}`).then(reload, failed("Undo"));
        });
      },
    });
  };
  const cheer = (w: Win) => {
    const on = !w.cheers.includes(me);
    setData((s) => ({
      ...s,
      wins: s.wins.map((x) =>
        x.id === w.id ? { ...x, cheers: on ? [...x.cheers, me] : x.cheers.filter((c) => c !== me) } : x,
      ),
    }));
    void patch("win", w.id, { cheer: on }, "Save your cheer");
  };

  /* Hero figures */
  const doneCount = milestones.filter((m) => m.status === "Done").length;
  const daysLeft = countdown ? daysUntil(countdown.targetDate) : -1;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Our Space
          </h1>
          <p>Who we are, and where we're headed.</p>
        </div>
      </header>

      <section className="sp-focus" aria-labelledby="focus-label">
        <div className="sp-focus-main">
          <p id="focus-label" className="sp-kicker">
            Our current focus
          </p>
          {editingFocus ? (
            <FocusEditor initial={focus} onSave={saveFocus} onCancel={() => setEditingFocus(false)} />
          ) : (
            <>
              <h2 className={focus ? "" : "sp-focus-empty"}>
                {focus || "What are you working toward together right now?"}
              </h2>
              <button type="button" className="sp-on-hero" onClick={() => setEditingFocus(true)}>
                <Pencil aria-hidden="true" size={15} /> {focus ? "Edit our focus" : "Write our focus"}
              </button>
            </>
          )}
        </div>
        <dl className="sp-focus-stats">
          {daysLeft > 0 && countdown && (
            <div>
              <dt>days to {countdown.title}</dt>
              <dd>{daysLeft}</dd>
            </div>
          )}
          <div>
            <dt>milestones done</dt>
            <dd>
              {doneCount}/{milestones.length}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card sp-panel" aria-labelledby="road-title">
        <div className="sp-panel-head">
          <h2 id="road-title">Our roadmap</h2>
          <span className="sp-sub">The big moments, in order</span>
        </div>
        {milestones.length ? (
          <ol className="sp-road">
            {milestones.map((m) => {
              const Icon = iconOf(m.icon);
              const now = m.id === milestones.find((x) => x.status === "In progress")?.id;
              return (
                <li key={m.id} className={["sp-stop", m.status === "Done" && "done", now && "now"].filter(Boolean).join(" ")}>
                  <span className="sp-stop-dot" aria-hidden="true">
                    {m.status === "Done" ? <Check size={20} strokeWidth={2.6} /> : <Icon size={20} />}
                  </span>
                  <div className="sp-stop-body">
                    <h3>
                      <button
                        type="button"
                        className="sp-stop-title"
                        onClick={() => openMilestone(m)}
                        disabled={isTemp(m.id)}
                        aria-label={`Edit ${m.title}`}
                      >
                        {m.title}
                      </button>
                    </h3>
                    <div className="sp-stop-meta">
                      <label className="sr-only" htmlFor={`st-${m.id}`}>
                        Status of {m.title}
                      </label>
                      <select
                        id={`st-${m.id}`}
                        className={`sp-status status-${m.status.toLowerCase().replaceAll(" ", "-")}`}
                        value={m.status}
                        disabled={isTemp(m.id)}
                        onChange={(e) => setStatus(m, e.target.value as MilestoneStatus)}
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      {m.when && <span className="sp-when">{m.when}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty">Add the big moments ahead, like moving in together or a new job.</p>
        )}
        <InlineAdd
          id="add-milestone"
          label="New milestone"
          placeholder="Add a milestone, e.g. Adopt a dog"
          maxLength={60}
          button="Add"
          onAdd={addMilestone}
        />
      </section>

      <div className="sp-two">
        <section className="card sp-panel" aria-labelledby="ci-title">
          <div className="sp-panel-head">
            <h2 id="ci-title">{checkInTitle(checkIn)}</h2>
            <span className="sp-sub">{scheduleLabel(checkIn)}</span>
          </div>
          <div className={`sp-next${next.done ? " done" : ""}`}>
            <span className="sp-next-icon" aria-hidden="true">
              {next.done ? <Check size={22} strokeWidth={2.4} /> : <MessagesSquare size={22} />}
            </span>
            <div>
              <b>{next.done ? (checkIn.every === "weekly" ? "Done for this week" : "Done for now") : whenLabel}</b>
              <span>
                {next.done
                  ? `Next one: ${longDay.format(next.day)}`
                  : "Four short questions, about 10 minutes, together."}
              </span>
            </div>
            <button
              type="button"
              className={next.done ? "btn-secondary" : "btn-primary"}
              onClick={() => checkInRef.current?.showModal()}
            >
              {next.done ? "Check in again" : "Start"}
            </button>
          </div>
          {checkins.length === 0 ? (
            <p className="empty">Your check-ins will show here, so you can look back on how the weeks went.</p>
          ) : (
            <>
              <ul className="sp-history">
                {checkins.slice(0, allHistory ? undefined : HISTORY_SHOWN).map((c) => (
                  <CheckInEntry key={c.id} c={c} />
                ))}
              </ul>
              {checkins.length > HISTORY_SHOWN && (
                <button
                  type="button"
                  className="link-btn sp-more"
                  aria-expanded={allHistory}
                  onClick={() => setAllHistory((v) => !v)}
                >
                  {allHistory ? "Show fewer" : `Show all ${checkins.length}`}
                </button>
              )}
            </>
          )}
        </section>

        <section className="card sp-panel" aria-labelledby="wins-title">
          <div className="sp-panel-head">
            <h2 id="wins-title">Wins</h2>
            <span className="sp-sub">Small or big, they count</span>
          </div>
          <InlineAdd
            id="add-win"
            label="New win"
            placeholder="Something to celebrate…"
            maxLength={120}
            button="Add win"
            primary
            onAdd={addWin}
          />
          {wins.length === 0 ? (
            <p className="empty">Passed a test? Booked the flights? Write it down and cheer each other on.</p>
          ) : (
            <ul className="sp-wins">
              {wins.map((w) => {
                const mine = w.cheers.includes(me);
                return (
                  <li key={w.id} className="sp-win">
                    <p>{w.text}</p>
                    <div className="sp-win-foot">
                      <span>
                        {w.who && <Avatars owner={w.who} />}
                        {shortDate.format(new Date(w.at))}
                      </span>
                      <button
                        type="button"
                        className="sp-cheer"
                        aria-pressed={mine}
                        disabled={isTemp(w.id)}
                        onClick={() => cheer(w)}
                        aria-label={`${mine ? "Remove your cheer for" : "Cheer for"} ${w.text}, ${w.cheers.length} so far`}
                      >
                        <Heart aria-hidden="true" size={14} fill={mine ? "currentColor" : "none"} />
                        {w.cheers.length}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>


      <MilestoneDialog
        ref={milestoneRef}
        milestone={editingMilestone}
        onSave={(f, id) => {
          void editMilestone(f, id);
          notify({ message: "Milestone saved", ok: true });
        }}
        onDelete={(id) => {
          const m = data.milestones.find((x) => x.id === id);
          removeLater("milestone", id, `Deleted “${m?.title ?? "milestone"}”`);
        }}
      />
      <CheckInDialog ref={checkInRef} title={checkInTitle(checkIn)} onSave={saveCheckIn} />
    </>
  );
}

/* Pieces */

// A one-line form: text field and button. Empty submits put focus back in the field.
function InlineAdd({
  id,
  label,
  placeholder,
  maxLength,
  button,
  primary,
  onAdd,
}: Readonly<{
  id: string;
  label: string;
  placeholder: string;
  maxLength: number;
  button: string;
  primary?: boolean;
  onAdd: (text: string) => void;
}>) {
  return (
    <form
      className="sp-inline-add"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem(id) as HTMLInputElement;
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        onAdd(text);
        input.value = "";
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input id={id} name={id} type="text" maxLength={maxLength} autoComplete="off" placeholder={placeholder} />
      <button type="submit" className={primary ? "btn-primary" : "btn-secondary"}>
        {button}
      </button>
    </form>
  );
}

function FocusEditor({
  initial,
  onSave,
  onCancel,
}: Readonly<{ initial: string; onSave: (v: string) => void; onCancel: () => void }>) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="sp-focus-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <label className="sr-only" htmlFor="focus-input">
        Our focus
      </label>
      <textarea
        id="focus-input"
        autoFocus // opened by the Edit button
        maxLength={140}
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.setSelectionRange(value.length, value.length)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSave(value);
          }
        }}
        placeholder="e.g. A home together. A job that fits. Thailand in 2027."
      />
      <div className="sp-focus-actions">
        <button type="submit" className="sp-on-hero solid">
          Save
        </button>
        <button type="button" className="sp-on-hero" onClick={onCancel}>
          Cancel
        </button>
        <span className="sp-count" aria-live="polite">
          {140 - value.length} left
        </span>
      </div>
    </form>
  );
}

const answerRows = [
  { key: "good", label: "Went well" },
  { key: "hard", label: "Was hard" },
  { key: "next", label: "Next week" },
] as const;

function CheckInEntry({ c }: Readonly<{ c: CheckIn }>) {
  const who = (["owner", "partner"] as const).filter((p) => c.answers[p]);
  return (
    <li className="sp-entry">
      <div className="sp-entry-head">
        <span className="sp-entry-date">{shortDate.format(new Date(c.at))}</span>
        <span className="sp-moods-shown">
          {who.map((p) => {
            const mood = c.answers[p]!.mood;
            return (
              <span key={p} className={`sp-mood mood-${moods.indexOf(mood)}`}>
                <Avatars owner={p} /> {mood}
              </span>
            );
          })}
        </span>
      </div>
      <dl>
        {answerRows.map(({ key, label }) => {
          const said = who.filter((p) => c.answers[p]![key]);
          if (!said.length) return null;
          return (
            <div key={key}>
              <dt>{label}</dt>
              {said.map((p) => (
                <dd key={p}>
                  <Avatars owner={p} />
                  <span>{c.answers[p]![key]}</span>
                </dd>
              ))}
            </div>
          );
        })}
      </dl>
    </li>
  );
}
