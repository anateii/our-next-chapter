import { verifyToken } from "@clerk/backend";

export async function getUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
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
