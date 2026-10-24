import type { Task } from "../types";
import { Users, User } from "lucide-react";

const pill = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

export default function NextSteps({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
} & Readonly<{}>) {
  return (
    <section className="card">
      <h2>This week's next steps</h2>
      <ul className="tasks">
        {tasks.map((t) => (
          <li key={t.id} className={t.done ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => onToggle(t.id)}
              />
              {t.title}
            </label>
            <span className={`chip owner-${t.owner.toLowerCase()}`}>
              {t.owner === "Both" ? <Users size={14} /> : <User size={14} />}{" "}
              {t.owner}
            </span>
            <span className={`chip status-${pill(t.status)}`}>{t.status}</span>
          </li>
        ))}
      </ul>
      <a className="link" href="#tasks">
        View all tasks →
      </a>
    </section>
  );
}
