import { createContext, useContext } from "react";
import type { Person } from "../types";
import type { ApiMember } from "./goals";

// The two people in the space, by their place in it: "owner" started the
// space, "partner" joined with an invite. Names come from the members list.
export interface People {
  owner: string;
  partner: string | null; // null until someone has joined
}

export const peopleFrom = (members: readonly ApiMember[]): People => ({
  owner: members.find((m) => m.role === "owner")?.displayName?.trim() || "You",
  partner: members.find((m) => m.role === "partner")?.displayName?.trim() || null,
});

export const PeopleContext = createContext<People>({ owner: "You", partner: null });

export function usePeople() {
  const people = useContext(PeopleContext);
  const name = (p: Person) => {
    if (p === "Both") return "Both of us";
    if (p === "owner") return people.owner;
    return people.partner ?? "Your partner";
  };
  return {
    ...people,
    name,
    initial: (p: Exclude<Person, "Both">) => name(p).charAt(0).toUpperCase(),
    // "Ana & Maria", or just "Ana" until a partner joins
    couple: people.partner ? `${people.owner} & ${people.partner}` : people.owner,
    // Who a task or goal can be for: the partner only once there is one.
    choices: (people.partner ? ["Both", "owner", "partner"] : ["Both", "owner"]) as Person[],
  };
}
