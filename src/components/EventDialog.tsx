import { forwardRef, useState } from "react";
import { CircleAlert, Trash } from "lucide-react";
import type { CalendarEvent, EventKind, Person } from "../types";
import { eventKinds, eventStart, type EventEdits } from "../helpers/events";
import { usePeople } from "../helpers/people";

export interface NewEvent {
  title: string;
  startsAt: string; // ISO
  allDay: boolean;
  kind: EventKind;
  owner: Person;
  notes?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Adds an event, or edits `event` when one is passed. `day` ("YYYY-MM-DD")
// fills in the day for a new one.
const EventDialog = forwardRef<
  HTMLDialogElement,
  {
    event: CalendarEvent | null;
    day: string;
    onCreate: (e: NewEvent) => void;
    onSave: (id: string, edits: EventEdits) => void;
    onDelete: (id: string) => void;
  }
>(function EventDialog({ event, day, onCreate, onSave, onDelete }, ref) {
  const { choices, name } = usePeople();
  const [error, setError] = useState("");
  const [kindError, setKindError] = useState(false);
  // Bumped on every close: the form remounts with fresh defaults.
  const [session, setSession] = useState(0);

  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const kind = String(data.get("kind") ?? "");
    setError(title ? "" : "Give it a name, e.g. “Flat viewing”.");
    setKindError(!kind);
    // Focus the first field that needs fixing.
    if (!title || !kind) {
      e.currentTarget
        .querySelector<HTMLElement>(title ? "#event-kind" : "#event-title")
        ?.focus();
      return;
    }
    const fields = {
      title,
      ...eventStart(String(data.get("day") || day), String(data.get("time") ?? "")),
      kind: kind as EventKind,
      owner: data.get("owner") as Person,
      notes: String(data.get("notes") ?? "").trim(),
    };
    if (event) onSave(event.id, { ...fields, notes: fields.notes || null });
    else onCreate({ ...fields, notes: fields.notes || undefined });
    close();
  };

  return (
    <dialog
      ref={ref}
      className="dialog event-dialog"
      aria-labelledby="event-dialog-title"
      // No click-outside-to-close: a stray click shouldn't lose what was typed.
      onClose={() => {
        setError("");
        setKindError(false);
        setSession((s) => s + 1);
      }}
    >
      <form key={`${event?.id ?? day}-${session}`} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="event-dialog-title">{event ? "Edit event" : "New event"}</h2>
        </div>

        <div className="field">
          <label htmlFor="event-title">What's happening</label>
          <input
            id="event-title"
            name="title"
            type="text"
            maxLength={200}
            autoComplete="off"
            defaultValue={event?.title}
            placeholder="e.g. Dinner with Maya & Tom"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "event-title-error" : undefined}
          />
          {error && (
            <p id="event-title-error" className="field-error" role="alert">
              <CircleAlert aria-hidden="true" size={16} />
              {error}
            </p>
          )}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="event-day">Day</label>
            <input
              id="event-day"
              name="day"
              type="date"
              defaultValue={event ? dayOf(event.date) : day}
            />
          </div>
          <div className="field">
            <label htmlFor="event-time">Time</label>
            <input
              id="event-time"
              name="time"
              type="time"
              defaultValue={event && !event.allDay ? timeOf(event.date) : ""}
              aria-describedby="event-time-hint"
            />
            <p id="event-time-hint" className="field-hint">
              Leave empty for all day
            </p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="event-kind">Event</label>
          <select
            id="event-kind"
            name="kind"
            required
            // Old "checkin" events have no option here, so they ask again.
            defaultValue={event && event.kind !== "checkin" ? event.kind : ""}
            aria-invalid={kindError || undefined}
            aria-describedby={kindError ? "event-kind-error" : undefined}
            onChange={() => setKindError(false)}
          >
            <option value="" disabled>
              Choose the type of event
            </option>
            {eventKinds.map(({ kind, label }) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
          {kindError && (
            <p id="event-kind-error" className="field-error" role="alert">
              <CircleAlert aria-hidden="true" size={16} />
              Choose what kind of event this is.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="event-owner">Who's going</label>
          <select id="event-owner" name="owner" defaultValue={event?.owner ?? "Both"}>
            {choices.map((o) => (
              <option key={o} value={o}>
                {name(o)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="event-notes">Notes</label>
          <textarea
            id="event-notes"
            name="notes"
            maxLength={1000}
            rows={3}
            defaultValue={event?.notes}
            placeholder="Address, what to bring, booking reference…"
          />
        </div>

        <div className="dialog-actions">
          {event && (
            <button
              type="button"
              className="btn-ghost-danger event-delete"
              onClick={() => {
                onDelete(event.id);
                close();
              }}
            >
              <Trash aria-hidden="true" size={16} /> Delete
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {event ? "Save changes" : "Add event"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default EventDialog;
