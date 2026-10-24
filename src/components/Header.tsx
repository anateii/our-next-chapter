import { Plus } from "lucide-react";

export default function Header({ onAddStep }: { onAddStep?: () => void }) {
  return (
    <header className="header">
      <div>
        <h1>Our Next Chapter</h1>
        <span className="sub">Ana &amp; Oliver</span>{" "}
        <span className="muted">• One step at a time</span>
      </div>
      <div className="photo" />
      <button className="btn" onClick={onAddStep}>
        <Plus size={16} /> Add a step
      </button>
      <div className="avatar" style={{ background: "#ece7f7" }}>
        A
      </div>
      <div className="avatar" style={{ background: "#e3ecdf" }}>
        O
      </div>
    </header>
  );
}
