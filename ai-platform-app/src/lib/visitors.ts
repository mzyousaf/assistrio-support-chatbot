import { connectToDatabase } from "@/lib/mongoose";
import { Visitor, type VisitorDocument } from "@/models/Visitor";

export type BotType = "showcase" | "visitor-own";

type VisitorProfileUpdate = {
  name?: string;
  email?: string;
  phone?: string;
};

type UsageLimits = {
  showcaseMessageLimit: number;
  ownBotMessageLimit: number;
};

type UsageCheckResult = {
  allowed: boolean;
  current: number;
  limit: number;
};

export async function getOrCreateVisitor(
  visitorId: string,
): Promise<VisitorDocument> {
  await connectToDatabase();

  if (!visitorId) {
    throw new Error("visitorId is required.");
  }

  const now = new Date();

  const existingVisitor = await Visitor.findOneAndUpdate(
    { visitorId },
    { $set: { lastSeenAt: now } },
    { new: true },
  );

  if (existingVisitor) {
    return existingVisitor;
  }

  const createdVisitor = await Visitor.create({
    visitorId,
    showcaseMessageCount: 0,
    ownBotMessageCount: 0,
    createdAt: now,
    lastSeenAt: now,
  });

  return createdVisitor;
}

export async function updateVisitorProfile(
  visitorId: string,
  data: VisitorProfileUpdate,
): Promise<VisitorDocument | null> {
  await connectToDatabase();

  if (!visitorId) {
    throw new Error("visitorId is required.");
  }

  const now = new Date();
  const updateFields: Partial<VisitorProfileUpdate> & { lastSeenAt: Date } = {
    lastSeenAt: now,
  };

  if (data.name !== undefined) {
    updateFields.name = data.name;
  }
  if (data.email !== undefined) {
    updateFields.email = data.email;
  }
  if (data.phone !== undefined) {
    updateFields.phone = data.phone;
  }

  const updatedVisitor = await Visitor.findOneAndUpdate(
    { visitorId },
    { $set: updateFields },
    { new: true, upsert: false },
  );

  return updatedVisitor;
}

export async function checkAndIncrementUsage(
  visitorId: string,
  botType: BotType,
  limits: UsageLimits,
): Promise<UsageCheckResult> {
  await connectToDatabase();

  if (!visitorId) {
    throw new Error("visitorId is required.");
  }

  const visitor = await Visitor.findOne({ visitorId });

  if (!visitor) {
    throw new Error("Visitor not found. Call getOrCreateVisitor first.");
  }

  const field =
    botType === "showcase" ? "showcaseMessageCount" : "ownBotMessageCount";
  const limit =
    botType === "showcase"
      ? limits.showcaseMessageLimit
      : limits.ownBotMessageLimit;

  const current = visitor[field];

  if (current >= limit) {
    return { allowed: false, current, limit };
  }

  const now = new Date();

  await Visitor.updateOne(
    { _id: visitor._id },
    { $inc: { [field]: 1 }, $set: { lastSeenAt: now } },
  );

  return { allowed: true, current: current + 1, limit };
}
