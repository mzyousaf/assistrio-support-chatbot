import { connectToDatabase } from "@/lib/mongoose";
import { Config, type ConfigDocument } from "@/models/Config";

export type LimitsConfig = {
  showcaseMessageLimit: number;
  ownBotMessageLimit: number;
};

const LIMITS_CONFIG_KEY = "limits";
const DEFAULT_LIMITS: LimitsConfig = {
  showcaseMessageLimit: 10,
  ownBotMessageLimit: 20,
};

function parseLimitValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getLimitsConfig(): Promise<LimitsConfig> {
  await connectToDatabase();

  const existingConfig = await Config.findOne({ key: LIMITS_CONFIG_KEY });

  if (!existingConfig) {
    const now = new Date();
    await Config.create({
      key: LIMITS_CONFIG_KEY,
      data: { ...DEFAULT_LIMITS },
      createdAt: now,
      updatedAt: now,
    });

    return { ...DEFAULT_LIMITS };
  }

  const showcaseMessageLimit = parseLimitValue(
    existingConfig.data?.showcaseMessageLimit,
    DEFAULT_LIMITS.showcaseMessageLimit,
  );
  const ownBotMessageLimit = parseLimitValue(
    existingConfig.data?.ownBotMessageLimit,
    DEFAULT_LIMITS.ownBotMessageLimit,
  );

  return { showcaseMessageLimit, ownBotMessageLimit };
}

export async function updateLimitsConfig(
  newValues: LimitsConfig,
): Promise<void | ConfigDocument> {
  await connectToDatabase();

  const now = new Date();

  const updatedConfig = await Config.findOneAndUpdate(
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
