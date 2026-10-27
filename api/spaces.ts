import { db } from "../db/client.js";
import { spaces, members } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getUserId, json } from "./_lib/auth.js";

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  // One space per person: stop if they already have one
  const existing = await db
    .select()
    .from(members)
    .where(eq(members.clerkUserId, userId));
  if (existing.length) return json({ error: "You already have a space" }, 409);

  const { name, displayName } = await req.json();

  const [space] = await db.insert(spaces).values({ name }).returning();
  await db.insert(members).values({
    spaceId: space.id,
    clerkUserId: userId,
    displayName,
    role: "owner",
  });

  return json({ space }, 201);
}
