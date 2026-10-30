import { useState } from "react";
import { Search, Bell } from "lucide-react";
import { UserButton, useUser } from "@clerk/react";

const views = ["Overview", "Recent activity", "Upcoming"];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function Header() {
  const { user } = useUser();
  const [view, setView] = useState("Overview");

  return (
    <>
      <div className="topbar">
        <div className="segmented" aria-label="Home views">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === view}
              className={v === view ? "active" : ""}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Search">
            <Search aria-hidden="true" size={20} />
          </button>
          <button type="button" className="icon-btn" aria-label="Notifications, 1 new">
            <Bell aria-hidden="true" size={20} />
            <span className="badge-dot" aria-hidden="true" />
          </button>
          <UserButton />
        </div>
      </div>
      <header className="greeting">
        <p>
          {greeting()}
          {user?.firstName ? `, ${user.firstName}` : ""}
        </p>
        <h1>
          <strong>Same team,</strong> brighter tomorrows.
        </h1>
      </header>
    </>
  );
}
