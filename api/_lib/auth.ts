import { verifyToken } from "@clerk/backend";

// Clerk keeps the session token in the __session cookie on same-origin
// requests. Plain <img> loads (goal photos) can't send a Bearer header,
// so they authenticate with that cookie instead.
const sessionCookie = (req: Request) =>
  /(?:^|;\s*)__session=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1] ?? null;

export async function getUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : sessionCookie(req);
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    return payload.sub;
  } catch (err) {
    console.error("verifyToken failed:", err);
    return null;
  }
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
