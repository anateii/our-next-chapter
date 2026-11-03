import { useUser } from "@clerk/react";

const homeViews = ["Overview", "Recent activity", "Upcoming"] as const;
export type HomeView = (typeof homeViews)[number];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function Header({
  view,
  onView,
  newCount,
}: Readonly<{
  view: HomeView;
  onView: (v: HomeView) => void;
  newCount: number; // the partner's activity since I last opened the feed
}>) {
  const { user } = useUser();

  return (
    <>
      <div className="topbar">
        <div className="segmented" aria-label="Home views">
          {homeViews.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === view}
              className={v === view ? "active" : ""}
              onClick={() => onView(v)}
            >
              {v}
              {v === "Recent activity" && newCount > 0 && (
                <>
                  <span className="seg-dot" aria-hidden="true" />
                  <span className="sr-only">, {newCount} new</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
      <header className="greeting">
        <p>
          {greeting()}
          {user?.firstName ? `, ${user.firstName}` : ""}
        </p>
        <h1 id="page-title" tabIndex={-1}>
          <strong>Same team,</strong> brighter tomorrows.
        </h1>
      </header>
    </>
  );
}
