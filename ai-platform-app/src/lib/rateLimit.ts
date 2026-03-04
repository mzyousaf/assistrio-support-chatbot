import { connectToDatabase } from "@/lib/mongoose";
import { RateLimit } from "@/models/RateLimit";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  windowStart: Date;
};

export async function checkRateLimit(options: {
  key: string; // e.g. "demo_chat:visitorId"
  limit: number; // e.g. 30
  windowMs: number; // e.g. 60_000
}): Promise<RateLimitResult> {
  const { key, limit, windowMs } = options;

  await connectToDatabase();

  const now = Date.now();
  const windowStartTimestamp = now - (now % windowMs); // floor to window boundary
  const windowStart = new Date(windowStartTimestamp);

  try {
    const result = await RateLimit.findOneAndUpdate(
      { key, windowStart },
      {
        $setOnInsert: { windowStart },
        $inc: { count: 1 },
      },
      {
        new: true,
        upsert: true,
      },
    ).lean();

    const count = result?.count ?? 1;
    const allowed = count <= limit;

    return {
      allowed,
      count,
      limit,
      windowStart,
    };
  } catch (err) {
    // If rate limit storage fails, we should NOT break core logic.
    console.error("Rate limit check failed", err);
    // Fail-open: allow the request but with count=0.
    return {
      allowed: true,
      count: 0,
      limit,
      windowStart,
    };
  }
}
