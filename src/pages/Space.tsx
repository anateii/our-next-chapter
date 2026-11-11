import { useRef, useState } from "react";
import { Check, Heart, MessagesSquare } from "lucide-react";
import type { Person } from "../types";
import type { ApiMember } from "../helpers/goals";
import type { Partner } from "../helpers/finances";
import { usePeople } from "../helpers/people";
import {
  checkInTitle,
  nextCheckIn,
  scheduleLabel,
  type CheckInSchedule,
} from "../helpers/checkins";
import {
  fromApiOurSpace,
  moods,
  type ApiOurSpace,
  type CheckIn,
  type CheckInAnswers,
  type OurSpace,
  type Win,
} from "../helpers/ourspace";
import Avatars from "../components/Avatars";
import { CheckInDialog } from "../components/SpaceDialogs";
import "./Space.css";

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type Notify = (t: { message: string; ok: boolean; undo?: () => void }) => void;

const HISTORY_SHOWN = 3;

const shortDate = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const longDay = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const isTemp = (id: string) => id.startsWith("new-");
const tempId = () => `new-${crypto.randomUUID()}`;

const getNextCheckInState = (
  schedule: CheckInSchedule,
  checkins: readonly CheckIn[],
) => {
  const next = nextCheckIn(
    schedule,
    checkins.map((c) => c.at),
  );

  if (!next) {
    return {
      next: { day: new Date(), inDays: 0, done: false },
      nextTitle: "Your next check-in",
      nextSummary: "Four short questions, about 10 minutes, together.",
    };
  }

  return {
    next,
    nextTitle: next.done ? "Check-in complete" : "Your next check-in",
    nextSummary: next.done
      ? `Next one: ${longDay.format(next.day)}`
      : "Four short questions, about 10 minutes, together.",
  };
};

export default function Space({
  data,
  setData,
  api,
  notify,
  me: viewer,
  members,
  checkIn,
}: Readonly<{
  data: OurSpace;
  setData: React.Dispatch<React.SetStateAction<OurSpace>>;
  api: Api;
  notify: Notify;
  me: Person;
  members: readonly ApiMember[];
  checkIn: CheckInSchedule;
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
    notify({
      message: `Couldn't ${what.toLowerCase()}. Try again.`,
      ok: false,
    });
    void reload();
  };
  const write = <T,>(method: string, body?: unknown, query = "") =>
    api<T>(`/ourspace${query}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const patch = (
    type: string,
    id: string,
    fields: Record<string, unknown>,
    what: string,
  ) => write("PATCH", { type, id, ...fields }).then(reload, failed(what));

  const { wins, checkins } = data;

  /* Dialogs */
  const checkInRef = useRef<HTMLDialogElement>(null);

  /* Check-ins */
  const saveCheckIn = (answers: CheckInAnswers) => {
    const temp: CheckIn = {
      id: tempId(),
      answers,
      at: new Date().toISOString(),
    };
    setData((s) => ({ ...s, checkins: [temp, ...s.checkins] }));
    const saved = write<{ checkin: { id: string } }>("POST", {
      type: "checkin",
      answers,
    })
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
      undo: async () => {
        setData((s) => ({
          ...s,
          checkins: s.checkins.filter((c) => c.id !== temp.id),
        }));
        try {
          const id = await saved;
          if (!id) return;
          await write(
            "DELETE",
            undefined,
            `?type=checkin&id=${encodeURIComponent(id)}`,
          );
          await reload();
        } catch (err) {
          failed("Undo")(err);
        }
      },
    });
  };
  const { next, nextTitle, nextSummary } = getNextCheckInState(
    checkIn,
    checkins,
  );
  const [allHistory, setAllHistory] = useState(false);

  /* Wins */
  const addWin = (text: string) => {
    const temp: Win = {
      id: tempId(),
      text,
      who: me,
      cheers: [],
      at: new Date().toISOString(),
    };
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
      message: partner
        ? `Win added. ${name(other)} will see it in Recent activity.`
        : "Win added",
      ok: true,
      undo: async () => {
        setData((s) => ({
          ...s,
          wins: s.wins.filter((w) => w.id !== temp.id),
        }));
        try {
          const id = await saved;
          if (!id) return;
          await write(
            "DELETE",
            undefined,
            `?type=win&id=${encodeURIComponent(id)}`,
          );
          await reload();
        } catch (err) {
          failed("Undo")(err);
        }
      },
    });
  };
  const cheer = (w: Win) => {
    const on = !w.cheers.includes(me);
    setData((s) => ({
      ...s,
      wins: s.wins.map((x) =>
        x.id === w.id
          ? {
              ...x,
              cheers: on ? [...x.cheers, me] : x.cheers.filter((c) => c !== me),
            }
          : x,
      ),
    }));
    void patch("win", w.id, { cheer: on }, "Save your cheer");
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Our Space
          </h1>
          <p>Check in together and celebrate the wins.</p>
        </div>
      </header>

      <div className="sp-two">
        <section className="card sp-panel" aria-labelledby="ci-title">
          <div className="sp-panel-head">
            <h2 id="ci-title">{checkInTitle(checkIn)}</h2>
            <span className="sp-sub">{scheduleLabel(checkIn)}</span>
          </div>
          <div className={`sp-next${next.done ? " done" : ""}`}>
            <span className="sp-next-icon" aria-hidden="true">
              {next.done ? (
                <Check size={22} strokeWidth={2.4} />
              ) : (
                <MessagesSquare size={22} />
              )}
            </span>
            <div>
              <b>{nextTitle}</b>
              <span>{nextSummary}</span>
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
            <p className="empty">
              Your check-ins will show here, so you can look back on how the
              weeks went.
            </p>
          ) : (
            <>
              <ul className="sp-history">
                {checkins
                  .slice(0, allHistory ? undefined : HISTORY_SHOWN)
                  .map((c) => (
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
            <p className="empty">
              Passed a test? Booked the flights? Write it down and cheer each
              other on.
            </p>
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
                        <Heart
                          aria-hidden="true"
                          size={14}
                          fill={mine ? "currentColor" : "none"}
                        />
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

      <CheckInDialog
        ref={checkInRef}
        title={checkInTitle(checkIn)}
        onSave={saveCheckIn}
      />
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
        const input = e.currentTarget.elements.namedItem(
          id,
        ) as HTMLInputElement;
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
      <input
        id={id}
        name={id}
        type="text"
        maxLength={maxLength}
        autoComplete="off"
        placeholder={placeholder}
      />
      <button
        type="submit"
        className={primary ? "btn-primary" : "btn-secondary"}
      >
        {button}
      </button>
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
        <span className="sp-entry-date">
          {shortDate.format(new Date(c.at))}
        </span>
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
