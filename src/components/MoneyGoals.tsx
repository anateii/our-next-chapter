import type { MoneyGoal } from "../types";

export default function MoneyGoals({
  goals,
  onSetTarget,
}: {
  goals: MoneyGoal[];
  onSetTarget: (id: string, t: number) => void;
}) {
  return (
    <section className="card">
      <h2>Money goals</h2>
      {goals.map((g) => {
        const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
        return (
          <div className="goal" key={g.id}>
            <span>{g.name}</span>
            <div className="bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <button
              className="link"
              onClick={() => {
                const v = Number(prompt(`Target for ${g.name}?`));
                if (v > 0) onSetTarget(g.id, v);
              }}
            >
              {g.target ? `€${g.target}` : "Set target"}
            </button>
          </div>
        );
      })}
    </section>
  );
}
