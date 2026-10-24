import { Home, Plane, ChevronRight, Info } from "lucide-react";
import { plans } from "../data";
import type { Plan } from "../types";

export default function Plans({ onOpen }: Readonly<{ onOpen?: (p: Plan) => void }>) {
  return (
    <section className="card">
      <h2>Our plans</h2>
      {plans.map((p) => (
        <button
          key={p.id}
          className={`rowlink plan-${p.id.toLowerCase()}`}
          onClick={() => onOpen?.(p)}
        >
          {p.icon === "home" ? <Home size={20} /> : <Plane size={20} />}
          <div className="grow">
            <span className="chip">{p.label.toUpperCase()}</span>
            <div style={{ marginTop: 6 }}>
              {p.steps.join(p.id === "A" ? " → " : " • ")}
            </div>
          </div>
          <ChevronRight size={18} />
        </button>
      ))}
      <p
        className="muted"
        style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}
      >
        <Info size={14} /> Review if work, visa or budget changes.
      </p>
    </section>
  );
}
