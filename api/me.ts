import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { members, spaces } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";

export async function GET(req: Request) {
  // 1. Who is asking?
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  // 2. Which space do they belong to?
  const rows = await db
    .select({ space: spaces, role: members.role })
    .from(members)
    .innerJoin(spaces, eq(members.spaceId, spaces.id))
    .where(eq(members.clerkUserId, userId))
    .limit(1);

  // 3. Answer
  return json({
    userId,
    space: rows[0]?.space ?? null, // null = new user, show onboarding
    role: rows[0]?.role ?? null,
  });
}
