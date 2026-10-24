import type { Win } from "../types";

export default function Wins({
  wins,
  onLog,
}: {
  wins: readonly Win[];
  onLog: (t: string) => void;
}) {
  return (
    <section className="card">
      <h2>Progress & wins</h2>
      {wins.length === 0 ? (
        <p className="muted">
          Completed steps appear here as we make progress.
        </p>
      ) : (
        <ul>
          {wins.map((w) => (
            <li key={w.id}>
              🌱 {w.text} <small>{w.date}</small>
            </li>
          ))}
        </ul>
      )}
      <button
        className="btn-outline"
        onClick={() => {
          const t = prompt("What did you achieve?");
          if (t) onLog(t);
        }}
      >
        + Log a win
      </button>
    </section>
  );
}
