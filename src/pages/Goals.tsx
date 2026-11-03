import { useRef, useState } from "react";
import { Plus, LayoutGrid, List } from "lucide-react";
import type { Goal, GoalStatus } from "../types";
import { goalStatus } from "../goals";
import GoalCard from "../components/GoalCard";
import NewGoalDialog from "../components/NewGoalDialog";
import "./Goals.css";

type Filter = "All" | GoalStatus;
const filters: Filter[] = ["All", "In progress", "Not started", "Completed"];

export default function Goals({
  goals,
  onCreate,
  onFeature,
  onComplete,
}: Readonly<{
  goals: readonly Goal[];
  onCreate: (g: Omit<Goal, "id">) => void;
  onFeature: (id: string) => void;
  onComplete: (id: string) => void;
}>) {
  const [filter, setFilter] = useState<Filter>("All");
  const [view, setView] = useState<"grid" | "list">("grid");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const count = (f: Filter) =>
    f === "All" ? goals.length : goals.filter((g) => goalStatus(g) === f).length;
  const visible = filter === "All" ? goals : goals.filter((g) => goalStatus(g) === filter);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Our Goals
          </h1>
          <p>Big plans, small steps.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => dialogRef.current?.showModal()}>
          <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> New goal
        </button>
      </header>

      <div className="goals-toolbar">
        <div className="segmented" aria-label="Filter goals">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === filter}
              className={f === filter ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f} <span className="seg-count">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="view-toggle" aria-label="Layout">
          <button
            type="button"
            className="icon-btn"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGrid aria-hidden="true" size={18} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? "goal" : "goals"}
      </p>

      {visible.length > 0 ? (
        <div className={view === "grid" ? "goals-grid" : "goals-list"}>
          {visible.map((g) => (
            <GoalCard key={g.id} goal={g} onFeature={onFeature} onComplete={onComplete} />
          ))}
        </div>
      ) : (
        <div className="card goals-empty">
          <h2>{filter === "Completed" ? "Nothing completed yet" : `No goals ${filter.toLowerCase()}`}</h2>
          <p>
            {filter === "Completed"
              ? "Finished goals will land here. Every step counts."
              : "Start something new together."}
          </p>
          <button type="button" className="btn-secondary" onClick={() => setFilter("All")}>
            Show all goals
          </button>
        </div>
      )}

      <NewGoalDialog ref={dialogRef} onCreate={onCreate} />
    </>
  );
}
