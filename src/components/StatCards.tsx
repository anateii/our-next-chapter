import { Target, Check, CalendarDays } from "lucide-react";

const RING_R = 21;
const RING_C = 2 * Math.PI * RING_R;

export default function StatCards({
  activeGoals,
  tasksLeft,
  upcomingEvents,
  adventureTitle,
  adventureProgress,
}: Readonly<{
  activeGoals: number;
  tasksLeft: number;
  upcomingEvents: number;
  adventureTitle: string;
  adventureProgress: number;
}>) {
  return (
    <section className="stats" aria-label="At a glance">
      <div className="card stat">
        <span className="stat-icon tint-accent" aria-hidden="true">
          <Target size={22} />
        </span>
        <div>
          <strong>{activeGoals}</strong>
          <span>Active goals</span>
        </div>
      </div>
      <div className="card stat">
        <span className="stat-icon tint-sage" aria-hidden="true">
          <Check size={22} strokeWidth={2.4} />
        </span>
        <div>
          <strong>{tasksLeft}</strong>
          <span>Tasks to do</span>
        </div>
      </div>
      <div className="card stat">
        <span className="stat-icon tint-accent" aria-hidden="true">
          <CalendarDays size={22} />
        </span>
        <div>
          <strong>{upcomingEvents}</strong>
          <span>Upcoming events</span>
        </div>
      </div>
      <div className="card stat">
        <svg className="ring" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={RING_R} className="ring-track" />
          <circle
            cx="26"
            cy="26"
            r={RING_R}
            className="ring-value"
            strokeDasharray={`${(adventureProgress / 100) * RING_C} ${RING_C}`}
            transform="rotate(-90 26 26)"
          />
        </svg>
        <div>
          <strong>{adventureProgress}%</strong>
          <span>{adventureTitle} goal</span>
        </div>
      </div>
    </section>
  );
}
