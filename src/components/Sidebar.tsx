import {
  Heart,
  House,
  SquareCheck,
  CalendarDays,
  Wallet,
  Smile,
  Settings,
} from "lucide-react";
import Avatars from "./Avatars";

const items = [
  { label: "Home", icon: House, href: "#home" },
  { label: "Our Goals", icon: Heart, href: "#goals" },
  { label: "Tasks", icon: SquareCheck, href: "#tasks" },
  { label: "Calendar", icon: CalendarDays, href: "#calendar" },
  { label: "Finances", icon: Wallet, href: "#finances" },
  { label: "Our Space", icon: Smile, href: "#space" },
];

export default function Sidebar({ active = "Home" }: Readonly<{ active?: string }>) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home">
        <Heart aria-hidden="true" size={26} strokeWidth={2.2} />
        <span>Our Next Chapter</span>
      </a>
      <nav aria-label="Main">
        {items.map(({ label, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            className={label === active ? "nav-link active" : "nav-link"}
            aria-current={label === active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={20} /> {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="couple">
          <Avatars owner="Both" />
          <span>Ana &amp; Oliver</span>
        </div>
        <a className="nav-link" href="#settings">
          <Settings aria-hidden="true" size={20} /> Settings
        </a>
      </div>
    </aside>
  );
}
