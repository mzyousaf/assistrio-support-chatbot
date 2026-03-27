import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Config } from '../models';

export interface LimitsConfig {
  showcaseMessageLimit: number;
  ownBotMessageLimit: number;
}

interface LimitBot {
  type?: 'showcase' | 'visitor-own' | string;
  limitOverrideMessages?: number;
  creatorType?: 'user' | 'visitor' | string;
  messageLimitMode?: 'none' | 'fixed_total' | string;
  messageLimitTotal?: number | null;
}

interface LimitVisitor {
  limitOverrideMessages?: number;
}

const LIMITS_CONFIG_KEY = 'limits';
const DEFAULT_LIMITS: LimitsConfig = {
  showcaseMessageLimit: 10,
  ownBotMessageLimit: 20,
};

function parseLimitValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

@Injectable()
export class LimitsService {
  constructor(
    @InjectModel(Config.name) private readonly configModel: Model<Config>,
  ) {}

  async getLimitsConfig(): Promise<LimitsConfig> {
    const existingConfig = await this.configModel.findOne({ key: LIMITS_CONFIG_KEY });

    if (!existingConfig) {
      const now = new Date();
      await this.configModel.create({
        key: LIMITS_CONFIG_KEY,
        data: { ...DEFAULT_LIMITS },
        createdAt: now,
        updatedAt: now,
      });
      return { ...DEFAULT_LIMITS };
    }

    const data = existingConfig.data as Record<string, unknown> | undefined;
    const showcaseMessageLimit = parseLimitValue(
      data?.showcaseMessageLimit,
      DEFAULT_LIMITS.showcaseMessageLimit,
    );
    const ownBotMessageLimit = parseLimitValue(
      data?.ownBotMessageLimit,
      DEFAULT_LIMITS.ownBotMessageLimit,
    );

    return { showcaseMessageLimit, ownBotMessageLimit };
  }

  async updateLimitsConfig(newValues: LimitsConfig): Promise<Config | undefined> {
    const now = new Date();

    const updatedConfig = await this.configModel.findOneAndUpdate(
      { key: LIMITS_CONFIG_KEY },
      {
        $set: {
          data: {
            showcaseMessageLimit: newValues.showcaseMessageLimit,
            ownBotMessageLimit: newValues.ownBotMessageLimit,
          },
          updatedAt: now,
        },
        $setOnInsert: {
          key: LIMITS_CONFIG_KEY,
          createdAt: now,
        },
      },
      { upsert: true, new: true },
    );

    return updatedConfig ?? undefined;
  }

  getMessageLimit(params: {
    bot: LimitBot;
    visitor: LimitVisitor;
    hasUserApiKey: boolean;
  }): number {
    // TODO(step-2 enforcement): apply bot.messageLimitMode/bot.messageLimitTotal here first.
    // This step intentionally keeps existing behavior unchanged.
    const visitorOverride =
      typeof params.visitor?.limitOverrideMessages === 'number' &&
      Number.isFinite(params.visitor.limitOverrideMessages)
        ? Math.max(1, Math.floor(params.visitor.limitOverrideMessages))
        : undefined;

    if (visitorOverride !== undefined) {
      return visitorOverride;
    }

    const botOverride =
      typeof params.bot?.limitOverrideMessages === 'number' &&
      Number.isFinite(params.bot.limitOverrideMessages)
        ? Math.max(1, Math.floor(params.bot.limitOverrideMessages))
        : undefined;

    if (botOverride !== undefined) {
      return botOverride;
    }

    if (params.hasUserApiKey) {
      return 50;
    }

    return params.bot?.type === 'showcase' ? 10 : 20;
  }
}
