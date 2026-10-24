import { Target } from "lucide-react";
import { focus } from "../data";

export default function FocusBanner() {
  return (
    <section className="focus">
      <Target size={40} color="#4f6f52" />
      <div>
        <small>CURRENT FOCUS</small>
        <h2>{focus}</h2>
      </div>
      <p className="quote">
        "Same team.
        <br />
        Brighter tomorrows."
      </p>
    </section>
  );
}
