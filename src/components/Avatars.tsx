import type { Person } from "../types";
import { usePeople } from "../helpers/people";

export default function Avatars({ owner }: Readonly<{ owner: Person }>) {
  const { name, initial, couple } = usePeople();
  return (
    <span className="avatars" title={owner === "Both" ? couple : name(owner)}>
      {owner !== "partner" && <span className="avatar avatar-owner">{initial("owner")}</span>}
      {owner !== "owner" && <span className="avatar avatar-partner">{initial("partner")}</span>}
    </span>
  );
}
