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

// One emoji (with its skin tone, ZWJ sequence, flag or keycap parts), as the
// emoji picker sends it. Anything else (text, several emojis) is refused.
export const isEmoji = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 32 &&
  /^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Component}]|\u200d|\ufe0f|\u20e3)+$/u.test(v) &&
  /[\p{Extended_Pictographic}\p{Regional_Indicator}]|\u20e3/u.test(v) &&
  [...new Intl.Segmenter().segment(v)].length === 1;
