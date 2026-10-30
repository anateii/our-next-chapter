import type { Person } from "../types";

export default function Avatars({ owner }: Readonly<{ owner: Person }>) {
  return (
    <span className="avatars" title={owner === "Both" ? "Ana & Oliver" : owner}>
      {owner !== "Oliver" && <span className="avatar avatar-ana">A</span>}
      {owner !== "Ana" && <span className="avatar avatar-oliver">O</span>}
    </span>
  );
}
