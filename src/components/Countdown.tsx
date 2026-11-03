import { useEffect, useState } from "react";
import { Hourglass, CalendarDays } from "lucide-react";
import type { Adventure } from "../types";
import { parseDay } from "../goals";
import FlipUnit from "./FlipUnit";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Re-render on each minute boundary so the minutes card flips in step with the clock.
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), MINUTE - (now % MINUTE) + 50);
    return () => clearTimeout(id);
  }, [now]);
  return now;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Countdown({ adventure }: Readonly<{ adventure: Adventure }>) {
  const now = useMinuteClock();
  const { targetDate } = adventure;
  const left = targetDate ? parseDay(targetDate).getTime() - now : null;

  let body;
  if (left === null) {
    body = <p className="empty">Pick a target date to start the countdown.</p>;
  } else if (left <= 0) {
    body = (
      <div className="countdown-done">
        <strong>It's here!</strong>
        <span>{adventure.title} starts now.</span>
      </div>
    );
  } else {
    const days = Math.floor(left / DAY);
    const hours = Math.floor((left % DAY) / HOUR);
    const minutes = Math.floor((left % HOUR) / MINUTE);
    body = (
      <>
        <div className="flips">
          <FlipUnit value={String(days)} label={days === 1 ? "Day" : "Days"} />
          <FlipUnit value={String(hours).padStart(2, "0")} label="Hours" />
          <FlipUnit value={String(minutes).padStart(2, "0")} label="Minutes" />
        </div>
        <p className="sr-only">
          {plural(days, "day")}, {plural(hours, "hour")} and {plural(minutes, "minute")} to go.
        </p>
      </>
    );
  }

  return (
    <section className="card panel countdown" aria-labelledby="countdown-title">
      <div className="panel-head">
        <h2 id="countdown-title">Countdown</h2>
        <span className="stat-icon tint-accent" aria-hidden="true">
          <Hourglass size={22} />
        </span>
      </div>
      {body}
      {targetDate && (
        <ul className="events countdown-target">
          <li>
            <span className="event-icon kind-checkin" aria-hidden="true">
              <CalendarDays size={20} />
            </span>
            <div>
              <time className="event-title" dateTime={targetDate}>
                {dateFormat.format(parseDay(targetDate))}
              </time>
              <span className="event-when">{adventure.title}</span>
            </div>
          </li>
        </ul>
      )}
    </section>
  );
}
