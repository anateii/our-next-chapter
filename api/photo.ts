import { get } from "@vercel/blob";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership } from "./_lib/space.js";
import { isSpacePhoto } from "./_lib/photos.js";

// Serve a goal photo from the private store: GET /api/photo?path=goals/<space>/...
// Works from a plain <img src>, authenticated by Clerk's session cookie.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const me = await getMembership(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const path = new URL(req.url).searchParams.get("path");
  // Only your own space's photos; anything else looks like it doesn't exist.
  if (!isSpacePhoto(path, me.spaceId)) return json({ error: "Not found" }, 404);

  const photo = await get(path, { access: "private" });
  if (!photo || photo.statusCode !== 200) return json({ error: "Not found" }, 404);

  return new Response(photo.stream, {
    headers: {
      "content-type": photo.blob.contentType,
      // Each upload gets a new random name, so a path's bytes never change:
      // let this browser keep it, but never a shared cache.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
