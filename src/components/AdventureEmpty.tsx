import { ArrowRight, Plus, Sparkles } from "lucide-react";

// Stands in for the adventure + countdown row when no goal is featured.
export default function AdventureEmpty({
  goalCount,
  spaceName,
}: Readonly<{ goalCount: number; spaceName: string }>) {
  const none = goalCount === 0;
  let hint = `Feature one of your ${goalCount} goals to see its progress and countdown here.`;
  if (goalCount === 1) hint = "Feature your goal to see its progress and countdown here.";
  return (
    <section className="card adventure-empty" aria-labelledby="adventure-empty-title">
      <span className="stat-icon tint-accent" aria-hidden="true">
        <Sparkles size={24} />
      </span>
      <div className="adventure-empty-text">
        <h2 id="adventure-empty-title">
          {none ? "No goals set yet" : `Pick a goal for ${spaceName || "the two of you"}`}
        </h2>
        <p>
          {none
            ? "Add your first big plan together, like a trip, a move or a savings target. Feature it and it shows up here with a countdown."
            : hint}
        </p>
      </div>
      <a className="btn-primary" href="#goals">
        {none ? (
          <Plus aria-hidden="true" size={18} strokeWidth={2.4} />
        ) : (
          <ArrowRight aria-hidden="true" size={18} />
        )}
        {none ? "Create a goal" : "Choose a goal"}
      </a>
    </section>
  );
}
