import { forwardRef, useEffect, useRef, useState } from "react";
import { Check, Circle, CircleAlert, CircleCheck, CircleDot, SquareCheck, Trash, X } from "lucide-react";
import type { Goal, Task, TaskStatus } from "../types";
import { usePeople } from "../helpers/people";
import {
  addedAgo,
  daysToWeekend,
  groupLabels,
  joinDue,
  localDay,
  splitDue,
  taskGroup,
  taskStatuses,
  type TaskEdits,
} from "../helpers/tasks";
import Avatars from "./Avatars";

const statusIcons = { "To do": Circle, "In progress": CircleDot, Done: CircleCheck };

type Props = {
  task: Task | null;
  goals: readonly Goal[];
  onUpdate: (id: string, edits: TaskEdits) => Promise<boolean>;
  onDelete: (id: string) => void;
  onClose: () => void;
};

// Side panel (a bottom sheet on phones) with everything about one task.
// Every change saves as it's made; there is no Save button.
const TaskDetails = forwardRef<HTMLDialogElement, Props>(function TaskDetails(
  { task, goals, onUpdate, onDelete, onClose },
  ref,
) {
  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();
  return (
    <dialog
      ref={ref}
      className="dialog drawer"
      aria-labelledby="details-title"
      onClose={onClose}
      // Everything is already saved, so clicking the backdrop can safely close it.
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      {task && (
        <DetailsBody
          key={task.id}
          task={task}
          goals={goals}
          onUpdate={onUpdate}
          onDelete={(id) => {
            close();
            onDelete(id);
          }}
          close={close}
        />
      )}
    </dialog>
  );
});

export default TaskDetails;

function DetailsBody({
  task,
  goals,
  onUpdate,
  onDelete,
  close,
}: Readonly<{
  task: Task;
  goals: readonly Goal[];
  onUpdate: Props["onUpdate"];
  onDelete: (id: string) => void;
  close: () => void;
}>) {
  const { choices, name } = usePeople();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState("");
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notesTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const titleError = !title.trim();

  const save = (edits: TaskEdits, message = "Saved") =>
    onUpdate(task.id, edits).then((ok) => {
      if (!ok) return;
      setSaved(message);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(""), 1600);
    });

  const commitTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) save({ title: t });
  };
  const commitNotes = () => {
    clearTimeout(notesTimer.current);
    if (notes !== (task.notes ?? "")) save({ notes: notes || null });
  };

  // Typed text is saved on blur; closing the panel mid-edit saves it too.
  const latest = useRef({ commitTitle, commitNotes });
  useEffect(() => {
    latest.current = { commitTitle, commitNotes };
  });
  useEffect(
    () => () => {
      clearTimeout(savedTimer.current);
      latest.current.commitTitle();
      latest.current.commitNotes();
    },
    [],
  );

  useEffect(() => {
    if (confirming) deleteRef.current?.focus();
  }, [confirming]);

  const { day, time } = splitDue(task.dueAt);
  const setDue = (d: string, t: string) => save({ dueAt: joinDue(d, d ? t : "") });
  const dayChips = [
    ["Today", localDay(0)],
    ["Tomorrow", localDay(1)],
    ["This weekend", localDay(daysToWeekend())],
    ["No day", ""],
  ];

  return (
    <>
      <div className="drawer-head">
        <span className="drawer-crumb">
          <SquareCheck aria-hidden="true" size={16} />
          Task · {groupLabels[taskGroup(task)]}
        </span>
        <span className={`saved${saved ? " show" : ""}`} role="status">
          {saved && (
            <>
              <Check aria-hidden="true" size={14} strokeWidth={3} />
              {saved}
            </>
          )}
        </span>
        <button type="button" className="icon-btn" aria-label="Close task details" onClick={close}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      <div className="drawer-body">
        <div>
          <div className={`details-title-row${task.done ? " done" : ""}`}>
            <button
              type="button"
              className="check"
              aria-pressed={task.done}
              aria-label={task.done ? "Mark as not done" : "Mark as done"}
              onClick={() => save({ status: task.done ? "To do" : "Done" })}
            >
              <span>{task.done && <Check aria-hidden="true" size={14} strokeWidth={3} />}</span>
            </button>
            <label htmlFor="details-title" className="sr-only">
              Task
            </label>
            <textarea
              id="details-title"
              className="details-title"
              rows={1}
              maxLength={200}
              value={title}
              aria-invalid={titleError || undefined}
              aria-describedby={titleError ? "details-title-error" : undefined}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          {titleError && (
            <p id="details-title-error" className="field-error" role="alert">
              <CircleAlert aria-hidden="true" size={16} />
              Say what needs doing, e.g. “Book the theory test”.
            </p>
          )}
        </div>

        <fieldset className="details-field">
          <legend className="field-label">Who's doing it</legend>
          <div className="choice">
            {choices.map((o) => (
              <label key={o}>
                <input
                  type="radio"
                  name="details-owner"
                  value={o}
                  checked={task.owner === o}
                  onChange={() => save({ owner: o }, o === "Both" ? "Now shared" : `Now with ${name(o)}`)}
                />
                <span>
                  <Avatars owner={o} />
                  {name(o)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="details-field">
          <legend className="field-label">Status</legend>
          <div className="choice">
            {taskStatuses.map((s: TaskStatus) => {
              const Icon = statusIcons[s];
              return (
                <label key={s}>
                  <input
                    type="radio"
                    name="details-status"
                    value={s}
                    checked={task.status === s}
                    onChange={() => save({ status: s })}
                  />
                  <span>
                    <Icon aria-hidden="true" size={16} />
                    {s}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="details-field">
          <span className="field-label" id="details-when">
            When
          </span>
          <div className="chips" role="group" aria-labelledby="details-when">
            {dayChips.map(([label, value]) => (
              <button
                key={label}
                type="button"
                className="chip"
                aria-pressed={day === value}
                onClick={() => setDue(value, time)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="details-day" className="sr-only">
                Day
              </label>
              <input
                id="details-day"
                type="date"
                value={day}
                onChange={(e) => setDue(e.target.value, time)}
              />
            </div>
            <div className="field">
              <label htmlFor="details-time" className="sr-only">
                Time
              </label>
              <input
                id="details-time"
                type="time"
                value={time}
                // A time with no day means today.
                onChange={(e) => setDue(day || localDay(0), e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="details-goal">Part of a goal</label>
          <select
            id="details-goal"
            value={task.goalId ?? ""}
            onChange={(e) => save({ goalId: e.target.value || null })}
          >
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="details-notes">Notes</label>
          <textarea
            id="details-notes"
            className="details-notes"
            placeholder="Links, details, anything the other one should know"
            maxLength={2000}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              clearTimeout(notesTimer.current);
              notesTimer.current = setTimeout(() => latest.current.commitNotes(), 800);
            }}
            onBlur={commitNotes}
          />
        </div>
      </div>

      <div className="drawer-foot">
        {confirming ? (
          <div className="confirm" role="group" aria-labelledby="confirm-text">
            <p id="confirm-text">Delete this task for both of you?</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
            <button
              ref={deleteRef}
              type="button"
              className="btn-danger"
              onClick={() => onDelete(task.id)}
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <span className="details-meta">
              Added {task.createdBy ? `by ${task.createdBy} ` : ""}
              {addedAgo(task.createdAt)}
            </span>
            <button type="button" className="btn-ghost-danger" onClick={() => setConfirming(true)}>
              <Trash aria-hidden="true" size={16} />
              Delete task
            </button>
          </>
        )}
      </div>
    </>
  );
}
