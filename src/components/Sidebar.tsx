import {
  Heart,
  House,
  SquareCheck,
  CalendarDays,
  Wallet,
  Smile,
} from "lucide-react";
import AccountMenu from "./AccountMenu";
import type { SettingsTab } from "./SettingsDialog";

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

export default function Sidebar({
  active = "Home",
  onOpenSettings,
}: Readonly<{ active?: string; onOpenSettings: (tab: SettingsTab) => void }>) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home">
        {/* One per theme; CSS shows the one that matches [data-theme] */}
        <img className="brand-light" src="/ourly-logo-sidebar.png" alt="Ourly" width={404} height={120} />
        <img className="brand-dark" src="/ourly-logo-dark-sidebar.png" alt="Ourly" width={404} height={120} />
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
          <Smile aria-hidden="true" size={20} />{" "}
          <span className="nav-label">Our Space</span>
        </a>
        <AccountMenu onOpenSettings={onOpenSettings} />
      </div>
    </aside>
  );
}
