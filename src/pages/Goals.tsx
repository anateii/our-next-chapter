import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Plus, LayoutGrid, List } from "lucide-react";
import type { Goal, GoalStatus } from "../types";
import { goalStatus, type GoalSteps } from "../goals";
import GoalCard from "../components/GoalCard";
import NewGoalDialog, { type GoalEdits } from "../components/NewGoalDialog";
import "./Goals.css";
import { smoothly } from "../helpers/motion";

type Filter = "All" | GoalStatus;
const filters: Filter[] = ["All", "In progress", "Not started", "Completed"];

// Empty-state heading when goals exist but none match the filter.
const emptyTitle: Record<Filter, string> = {
  All: "No goals yet",
  "In progress": "Nothing in progress",
  "Not started": "Everything's under way",
  Completed: "Nothing completed yet",
};

export default function Goals({
  goals,
  steps,
  onCreate,
  onAddStep,
  onToggleStep,
  onEdit,
  onFeature,
  onComplete,
}: Readonly<{
  goals: readonly Goal[];
  steps: ReadonlyMap<string, GoalSteps>; // by goal id
  onCreate: (g: Omit<Goal, "id">) => void;
  onAddStep: (goal: Goal, title: string) => Promise<unknown>;
  onToggleStep: (taskId: string) => void;
  onEdit: (id: string, edits: GoalEdits) => void;
  onFeature: (id: string) => void;
  onComplete: (id: string) => void;
}>) {
  const [filter, setFilter] = useState<Filter>("All");
  const [view, setView] = useState<"grid" | "list">("grid");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Goal | null>(null);

  // Render the dialog for this goal (or a new one) before opening it, so
  // showModal() focuses the right, freshly filled fields.
  const openDialog = (goal: Goal | null) => {
    flushSync(() => setEditing(goal));
    dialogRef.current?.showModal();
  };

  const count = (f: Filter) =>
    f === "All"
      ? goals.length
      : goals.filter((g) => goalStatus(g, steps.get(g.id)) === f).length;
  const visible =
    filter === "All"
      ? goals
      : goals.filter((g) => goalStatus(g, steps.get(g.id)) === filter);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Our Goals
          </h1>
          <p>Big plans, small steps.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openDialog(null)}
        >
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
              onClick={() => smoothly(() => setFilter(f))}
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
            onClick={() => smoothly(() => setView("grid"))}
          >
            <LayoutGrid aria-hidden="true" size={18} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => smoothly(() => setView("list"))}
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
            <GoalCard
              key={g.id}
              goal={g}
              steps={steps.get(g.id)}
              onEdit={openDialog}
              onFeature={onFeature}
              onComplete={onComplete}
            />
          ))}
        </div>
      ) : goals.length === 0 ? (
        // No goals at all: invite them to create the first one.
        <div className="card goals-empty">
          <h2>No goals yet</h2>
          <p>Start something new together.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openDialog(null)}
          >
            <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> Create your first goal
          </button>
        </div>
      ) : (
        // Goals exist, just none match this filter.
        <div className="card goals-empty">
          <h2>{emptyTitle[filter]}</h2>
          <p>
            {filter === "Completed"
              ? "Finished goals will land here. Every step counts."
              : "Nothing here right now."}
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFilter("All")}
          >
            Show all goals
          </button>
        </div>
      )}

      <NewGoalDialog
        ref={dialogRef}
        goal={editing}
        steps={editing ? steps.get(editing.id) : undefined}
        onCreate={onCreate}
        onEdit={onEdit}
        onAddStep={onAddStep}
        onToggleStep={onToggleStep}
      />
    </>
  );
}
