import { Check, Star } from "lucide-react";
import type { Goal } from "../types";
import { categoryIcons, goalProgress, goalStatus } from "../goals";
import Avatars from "./Avatars";
import GoalMenu from "./GoalMenu";

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

export default function GoalCard({
  goal,
  onFeature,
  onComplete,
}: Readonly<{
  goal: Goal;
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
              {
                label: goal.featured ? "Featured on Home" : "Feature on Home",
                onSelect: () => onFeature(goal.id),
                disabled: goal.featured,
              },
              {
                label: "Mark as completed",
                onSelect: () => onComplete(goal.id),
                disabled: status === "Completed" || goal.stepsTotal === 0,
              },
            ]}
          />
        </div>
        <p className="goal-meta">
          {goal.category} ·{" "}
          {goal.stepsTotal
            ? `${goal.stepsDone} of ${goal.stepsTotal} steps`
            : "No steps yet"}
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
            {goal.nextStep ? (
              <>
                <span>Next:</span> {goal.nextStep}
              </>
            ) : (
              <span>No next step yet</span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
