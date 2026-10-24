import {
  Sprout,
  Home,
  Map,
  CheckSquare,
  GitBranch,
  Database,
  Lightbulb,
  Calendar,
} from "lucide-react";

const items = [
  { label: "Overview", icon: Home, href: "#overview" },
  { label: "Roadmap", icon: Map, href: "#roadmap" },
  { label: "Our tasks", icon: CheckSquare, href: "#tasks" },
  { label: "Plan A / Plan B", icon: GitBranch, href: "#plans" },
  { label: "Money", icon: Database, href: "#money" },
  { label: "Decisions", icon: Lightbulb, href: "#decisions" },
];

export default function Sidebar({ active = "Overview" }: { active?: string }) {
  return (
    <aside className="sidebar">
      <Sprout color="#4f6f52" size={28} />
      <nav>
        {items.map(({ label, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            className={label === active ? "active" : ""}
          >
            <Icon size={18} /> {label}
          </a>
        ))}
      </nav>
      <div className="checkin">
        <Calendar size={18} />
        <div>
          Weekly check-in
          <br />
          <span className="muted">Sunday</span>
        </div>
      </div>
    </aside>
  );
}
