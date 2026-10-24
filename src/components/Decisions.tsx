import { Lightbulb, MapPin, Calendar, ChevronRight } from "lucide-react";
import { decisions } from "../data";
import type { Decision } from "../types";

export default function Decisions({
  onOpen,
}: {
  readonly onOpen?: (d: Decision) => void;
}) {
  return (
    <section className="card">
      <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Lightbulb size={20} /> Decisions to make
      </h2>
      {decisions.map((d) => (
        <button
          key={d.id}
          className="rowlink decision"
          onClick={() => onOpen?.(d)}
        >
          {d.icon === "pin" ? <MapPin size={18} /> : <Calendar size={18} />}
          <span className="grow">{d.question}</span>
          <ChevronRight size={18} />
        </button>
      ))}
      <button className="rowlink decision" style={{ borderBottom: "none" }}>
        <Calendar size={16} />{" "}
        <span className="grow muted">Sunday • 15 minutes</span>{" "}
        <ChevronRight size={16} />
      </button>
    </section>
  );
}
