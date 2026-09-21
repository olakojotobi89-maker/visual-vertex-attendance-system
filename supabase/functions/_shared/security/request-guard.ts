// Shared request guards for VSAS Edge Functions.
// These controls complement Supabase Auth and database RLS; they are not a replacement.

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

export function requestOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!configured.length) return false;
  return configured.includes(origin);
}

export function requireJsonRequest(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, message: "Content-Type must be application/json." };
  }
  return { ok: true };
}

export function rateLimit(key: string, limit: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  if (requestBuckets.size > MAX_KEYS) {
    for (const [bucketKey, bucket] of requestBuckets) {
      if (bucket.resetAt <= now) requestBuckets.delete(bucketKey);
    }
  }
  const current = requestBuckets.get(key);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return { allowed: current.count <= limit, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
}

export function clientKey(req: Request, identity = "anonymous"): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${identity}:${forwarded}`.slice(0, 220);
}
