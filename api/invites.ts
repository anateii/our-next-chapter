import { db } from "../db/client.js";
import { invites, members } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getUserId, json } from "./_lib/auth.js";

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const [me] = await db
    .select()
    .from(members)
    .where(eq(members.clerkUserId, userId));
  if (!me) return json({ error: "Create a space first" }, 400);

  const code = crypto.randomUUID().slice(0, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // valid for 7 days

  await db.insert(invites).values({ code, spaceId: me.spaceId, expiresAt });
  return json({ code, expiresAt }, 201);
}
