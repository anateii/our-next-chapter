import { Plus } from "lucide-react";
import { UserButton } from "@clerk/react";

export default function Header({
  onAddStep,
}: {
  readonly onAddStep?: () => void;
}) {
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
        <UserButton />
      </div>
    </header>
  );
}
