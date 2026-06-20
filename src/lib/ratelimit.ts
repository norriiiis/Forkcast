import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiting via Upstash Redis. Active only when the Upstash env vars are set
// (serverless-safe); a no-op otherwise so local dev isn't blocked.
const ENABLED = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const limiters = new Map<string, Ratelimit>();

function limiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  if (!ENABLED) return null;
  const key = `${name}:${limit}:${windowSec}`;
  let rl = limiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `fc:${name}`,
    });
    limiters.set(key, rl);
  }
  return rl;
}

/** Returns true if the request is allowed. No-op (always allowed) without keys. */
export async function allow(
  name: string,
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const rl = limiter(name, limit, windowSec);
  if (!rl) return true;
  try {
    const { success } = await rl.limit(identifier);
    return success;
  } catch {
    return true; // fail open
  }
}

/** Best-effort client IP from forwarding headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] || req.headers.get("x-real-ip") || "anon").trim();
}
