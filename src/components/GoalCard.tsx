import { Check, Star } from "lucide-react";
import type { Goal } from "../types";
import { categoryIcons, goalProgress, goalStatus, parseDay } from "../goals";
import Avatars from "./Avatars";
import GoalMenu from "./GoalMenu";

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
const byDate = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function GoalCard({
  goal,
  onEdit,
  onFeature,
  onComplete,
}: Readonly<{
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onFeature: (id: string) => void;
  onComplete: (id: string) => void;
}>) {
  const status = goalStatus(goal);
  const progress = goalProgress(goal);
  const Icon = categoryIcons[goal.category];

  return (
    <article className="card goal-card">
      <div className={`goal-cover cat-${slug(goal.category)}`}>
        {goal.image ? (
          <img src={goal.image} alt="" loading="lazy" width={640} height={360} />
        ) : (
          <Icon aria-hidden="true" size={44} strokeWidth={1.6} />
        )}
        <span className={`status-pill status-${slug(status)}`}>
          {status === "Completed" && <Check aria-hidden="true" size={14} strokeWidth={3} />}
          {status}
        </span>
        {goal.featured && (
          <span className="featured-pill">
            <Star aria-hidden="true" size={13} fill="currentColor" /> On Home
          </span>
        )}
      </div>

      <div className="goal-body">
        <div className="goal-head">
          <h2>{goal.title}</h2>
          <GoalMenu
            label={`More options for ${goal.title}`}
            actions={[
              { label: "Edit goal", onSelect: () => onEdit(goal) },
              {
                label: goal.featured ? "Featured on Home" : "Feature on Home",
                onSelect: () => onFeature(goal.id),
                disabled: goal.featured,
              },
              {
                label: "Mark as completed",
                onSelect: () => onComplete(goal.id),
                // A goal with no steps completes as 1 of 1 (see PATCH /api/goals).
                disabled: status === "Completed",
              },
            ]}
          />
        </div>
        <p className="goal-meta">
          {goal.category}
          {goal.targetDate && (
            <>
              {" · by "}
              <time dateTime={goal.targetDate}>
                {byDate.format(parseDay(goal.targetDate))}
              </time>
            </>
          )}
        </p>
        <div className="goal-progress">
          <div
            className="bar"
            role="progressbar"
            aria-label={`${goal.title} progress`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
        <div className="goal-next">
          <Avatars owner={goal.owner} />
          <p>
            <span>{goal.owner === "Both" ? "Both of us" : `${goal.owner} is leading`}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
