import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RateLimit } from '../models';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  windowStart: Date;
}

@Injectable()
export class RateLimitService {
  constructor(
    @InjectModel(RateLimit.name) private readonly rateLimitModel: Model<RateLimit>,
  ) {}

  async check(options: {
    key: string;
    limit: number;
    windowMs: number;
  }): Promise<RateLimitResult> {
    const { key, limit, windowMs } = options;

    const now = Date.now();
    const windowStartTimestamp = now - (now % windowMs);
    const windowStart = new Date(windowStartTimestamp);

    try {
      const result = await this.rateLimitModel
        .findOneAndUpdate(
          { key, windowStart },
          {
            $setOnInsert: { windowStart },
            $inc: { count: 1 },
          },
          {
            new: true,
            upsert: true,
          },
        )
        .lean();

      const count = result?.count ?? 1;
      const allowed = count <= limit;

      return {
        allowed,
        count,
        limit,
        windowStart,
      };
    } catch (err) {
      console.error('Rate limit check failed', err);
      return {
        allowed: true,
        count: 0,
        limit,
        windowStart,
      };
    }
  }
}
