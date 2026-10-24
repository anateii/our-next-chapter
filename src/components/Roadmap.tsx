import { Car, Briefcase, Home, Plane, Users } from "lucide-react";
import { milestones } from "../data";
import type { Milestone } from "../types";

const icons: Record<Milestone["icon"], React.JSX.Element> = {
  car: <Car />,
  job: <Briefcase />,
  home: <Home />,
  plane: <Plane />,
  people: <Users />,
};

export default function Roadmap() {
  return (
    <section className="card">
      <h2>Our roadmap</h2>
      <ol className="roadmap">
        {milestones.map((m) => (
          <li key={m.id}>
            <div className="circle">{icons[m.icon]}</div>
            <strong>{m.title}</strong>
            <span
              className={`chip status-${m.status.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {m.status}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
