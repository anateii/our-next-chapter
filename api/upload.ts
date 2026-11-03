import { put } from "@vercel/blob";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership } from "./_lib/space.js";
import { photoUrl } from "./_lib/photos.js";

const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
// The browser shrinks photos before upload, so this is a guard, not a target.
// (Vercel functions reject request bodies over 4.5 MB anyway.)
const MAX_BYTES = 4 * 1024 * 1024;

// Upload a goal photo. Body: the raw image, with its content-type header.
// Returns { url } (an /api/photo proxy URL) to save on the goal as imageUrl.
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const me = await getMembership(userId);
  if (!me) return json({ error: "Create a space first" }, 400);

  const type = req.headers.get("content-type") ?? "";
  const ext = TYPES[type];
  if (!ext) return json({ error: "Upload a WebP, JPEG or PNG image" }, 415);

  const body = await req.arrayBuffer();
  if (!body.byteLength) return json({ error: "The file is empty" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: "Image must be 4 MB or smaller" }, 413);

  // Private store: only /api/photo can read it back, for members of this space.
  const blob = await put(`goals/${me.spaceId}/photo.${ext}`, body, {
    access: "private",
    contentType: type,
    addRandomSuffix: true,
  });
  return json({ url: photoUrl(blob.pathname) }, 201);
}
