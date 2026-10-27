import { db } from "../db/client.js";
import { invites, members } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getUserId, json } from "./_lib/auth.js";

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const { code, displayName } = await req.json();

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.code, code));
  if (!invite) return json({ error: "Invalid code" }, 404);
  if (invite.usedAt) return json({ error: "Code already used" }, 410);
  if (invite.expiresAt < new Date())
    return json({ error: "Code expired" }, 410);

  const existing = await db
    .select()
    .from(members)
    .where(eq(members.clerkUserId, userId));
  if (existing.length) return json({ error: "You already have a space" }, 409);

  await db.insert(members).values({
    spaceId: invite.spaceId,
    clerkUserId: userId,
    displayName,
    role: "partner",
  });
  await db
    .update(invites)
    .set({ usedAt: new Date() })
    .where(eq(invites.code, code));

  return json({ spaceId: invite.spaceId }, 201);
}
