import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { Adventure } from "../types";
import { parseDay } from "../helpers/goals";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Re-render on each minute boundary so the minutes stay in step with the clock.
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), MINUTE - (now % MINUTE) + 50);
    return () => clearTimeout(id);
  }, [now]);
  return now;
}

// The countdown lines under the adventure's title: "141 days to go and 11 h 10 min", then the date.
export default function Countdown({ adventure }: Readonly<{ adventure: Adventure }>) {
  const now = useMinuteClock();
  const { targetDate } = adventure;

  if (!targetDate)
    return (
      <p className="countdown-note">
        <a href="#goals">Pick a target date</a> to start the countdown.
      </p>
    );

  const left = parseDay(targetDate).getTime() - now;
  let line;
  if (left <= 0) {
    line = <span className="countdown-big">It's here!</span>;
  } else {
    const days = Math.floor(left / DAY);
    const hours = Math.floor((left % DAY) / HOUR);
    const minutes = Math.floor((left % HOUR) / MINUTE);
    line =
      days > 0 ? (
        <>
          <span className="countdown-big">
            {days} {days === 1 ? "day" : "days"} to go
          </span>
          <span className="countdown-rest">
            and {hours} h {minutes} min
          </span>
        </>
      ) : (
        <span className="countdown-big">
          {hours} h {minutes} min to go
        </span>
      );
  }

  return (
    <>
      <p className="countdown">{line}</p>
      <p className="countdown-date">
        <CalendarDays aria-hidden="true" size={16} />
        <time dateTime={targetDate}>{dateFormat.format(parseDay(targetDate))}</time>
      </p>
    </>
  );
}
