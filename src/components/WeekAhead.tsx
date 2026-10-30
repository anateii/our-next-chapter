import { useState } from "react";
import { House, Utensils, MessageCircle } from "lucide-react";
import type { CalendarEvent } from "../types";

const icons = { home: House, food: Utensils, checkin: MessageCircle };

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const weekDays = (today: Date) => {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const fmtDay = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function WeekAhead({ events }: Readonly<{ events: readonly CalendarEvent[] }>) {
  const today = new Date();
  const days = weekDays(today);
  const [selected, setSelected] = useState<Date | null>(null);

  const visible = events.filter((e) =>
    selected ? sameDay(e.date, selected) : days.some((d) => sameDay(d, e.date)),
  );

  return (
    <section id="calendar" className="card panel">
      <div className="panel-head">
        <h2>Upcoming this week</h2>
        <a className="text-link" href="#calendar">
          See all
        </a>
      </div>
      <div className="week" role="group" aria-label="Pick a day">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          const isSelected = selected !== null && sameDay(d, selected);
          const hasPlans = events.some((e) => sameDay(e.date, d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={`day${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
              aria-pressed={isSelected}
              aria-label={`${fmtDay(d)}${isToday ? ", today" : ""}${hasPlans ? ", has plans" : ""}`}
              onClick={() => setSelected(isSelected ? null : d)}
            >
              <span className="day-name">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="day-num">{d.getDate()}</span>
              <span className={`day-dot${hasPlans ? " on" : ""}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {visible.length > 0 ? (
        <ul className="events">
          {visible.map((e) => {
            const Icon = icons[e.kind];
            return (
              <li key={e.id}>
                <span className={`event-icon kind-${e.kind}`} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  <span className="event-title">{e.title}</span>
                  <span className="event-when">
                    {fmtDay(e.date)} · {e.time}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">
          Nothing planned {selected ? `for ${fmtDay(selected)}` : "this week"}. A free evening
          together?
        </p>
      )}
    </section>
  );
}
