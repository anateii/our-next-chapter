import { Check, Plus } from "lucide-react";
import type { Task } from "../types";
import Avatars from "./Avatars";

const dots = ["var(--dot-1)", "var(--dot-2)", "var(--dot-3)"];

export default function TodayList({
  tasks,
  onToggle,
}: Readonly<{
  tasks: readonly Task[];
  onToggle: (id: string) => void;
}>) {
  const left = tasks.filter((t) => !t.done).length;

  return (
    <section id="tasks" className="card panel">
      <div className="panel-head">
        <div className="panel-title">
          <h2>Today</h2>
          <span className="count" aria-label={`${left} left`}>
            {left}
          </span>
        </div>
        <button type="button" className="fab" aria-label="Add a task for today">
          <Plus aria-hidden="true" size={18} strokeWidth={2.4} />
        </button>
      </div>
      <ul className="today">
        {tasks.map((t, i) => (
          <li key={t.id} className={t.done ? "done" : ""}>
            <button
              type="button"
              className="check"
              aria-pressed={t.done}
              aria-label={`${t.done ? "Mark as not done" : "Mark as done"}: ${t.title}`}
              onClick={() => onToggle(t.id)}
            >
              <span>{t.done && <Check aria-hidden="true" size={14} strokeWidth={3} />}</span>
            </button>
            <span className="dot" style={{ background: dots[i % dots.length] }} aria-hidden="true" />
            <div className="today-text">
              <span className="today-title">{t.title}</span>
              <span className="today-time">{t.time}</span>
            </div>
            <Avatars owner={t.owner} />
          </li>
        ))}
      </ul>
    </section>
  );
}
