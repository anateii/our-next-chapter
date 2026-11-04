import { get, put } from "@vercel/blob";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership } from "./_lib/space.js";
import { isSpacePhoto, photoUrl } from "./_lib/photos.js";

// Goal photos, in one endpoint (the Vercel Hobby plan allows 12 functions):
//   POST /api/photos               upload one (the raw image as the body)
//   GET  /api/photos?path=goals/…  show one

const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
// The browser shrinks photos before upload, so this is a guard, not a target.
// (Vercel functions reject request bodies over 4.5 MB anyway.)
const MAX_BYTES = 4 * 1024 * 1024;

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me };
}

// Serve a photo from the private store. Works from a plain <img src>,
// authenticated by Clerk's session cookie.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

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

// Upload a photo. Body: the raw image, with its content-type header.
// Returns { url } (a /api/photos proxy URL) to save on the goal as imageUrl.
export async function POST(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const type = req.headers.get("content-type") ?? "";
  const ext = TYPES[type];
  if (!ext) return json({ error: "Upload a WebP, JPEG or PNG image" }, 415);

  const body = await req.arrayBuffer();
  if (!body.byteLength) return json({ error: "The file is empty" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: "Image must be 4 MB or smaller" }, 413);

  // Private store: only GET /api/photos can read it back, for members of this space.
  const blob = await put(`goals/${me.spaceId}/photo.${ext}`, body, {
    access: "private",
    contentType: type,
    addRandomSuffix: true,
  });
  return json({ url: photoUrl(blob.pathname) }, 201);
}
