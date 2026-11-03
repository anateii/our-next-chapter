import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { members } from "../../db/schema.js";

// The signed-in user's membership, or undefined if they have no space yet.
export async function getMembership(userId: string) {
  const [me] = await db
    .select()
    .from(members)
    .where(eq(members.clerkUserId, userId))
    .limit(1);
  return me;
}

// Whether a Clerk user belongs to the given space (e.g. to validate an owner).
export async function isMember(spaceId: string, userId: string) {
  const [m] = await db
    .select({ id: members.clerkUserId })
    .from(members)
    .where(and(eq(members.spaceId, spaceId), eq(members.clerkUserId, userId)))
    .limit(1);
  return Boolean(m);
}

// Parses an ISO date query param, falling back when missing or invalid.
export function dateParam(url: URL, name: string, fallback: Date) {
  const raw = url.searchParams.get(name);
  const d = raw ? new Date(raw) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
