import {
  Heart,
  House,
  SquareCheck,
  CalendarDays,
  Wallet,
  Smile,
  Settings,
} from "lucide-react";
import { UserButton } from "@clerk/react";
import Avatars from "./Avatars";

// On small screens the nav becomes a bottom bar, which holds at most five
// items; "secondary" ones move to the top app bar instead.
const items = [
  { label: "Home", icon: House, href: "#home" },
  { label: "Our Goals", icon: Heart, href: "#goals" },
  { label: "Tasks", icon: SquareCheck, href: "#tasks" },
  { label: "Calendar", icon: CalendarDays, href: "#calendar" },
  { label: "Finances", icon: Wallet, href: "#finances" },
  { label: "Our Space", icon: Smile, href: "#space", secondary: true },
];

export default function Sidebar({ active = "Home" }: Readonly<{ active?: string }>) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home">
        <Heart aria-hidden="true" size={26} strokeWidth={2.2} />
        <span>Our Next Chapter</span>
      </a>
      <nav aria-label="Main">
        {items.map(({ label, icon: Icon, href, secondary }) => (
          <a
            key={label}
            href={href}
            className={[
              "nav-link",
              label === active && "active",
              secondary && "nav-secondary",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={label === active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={20} /> <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <a
          className="nav-link mobile-only"
          href="#space"
          aria-current={active === "Our Space" ? "page" : undefined}
        >
          <Smile aria-hidden="true" size={20} /> <span className="nav-label">Our Space</span>
        </a>
        <div className="couple">
          <Avatars owner="Both" />
          <span className="couple-name">Ana &amp; Oliver</span>
          <span className="couple-user">
            <UserButton />
          </span>
        </div>
        <a className="nav-link" href="#settings">
          <Settings aria-hidden="true" size={20} /> <span className="nav-label">Settings</span>
        </a>
      </div>
    </aside>
  );
}
