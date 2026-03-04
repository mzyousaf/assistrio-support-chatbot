import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/mongoose";
import {
  VisitorEvent,
  type VisitorEventType,
} from "@/models/VisitorEvent";

export async function logVisitorEvent(params: {
  visitorId: string;
  type: VisitorEventType;
  path?: string;
  botSlug?: string;
  botId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!params.visitorId) {
      return;
    }

    await connectToDatabase();

    const eventDoc: {
      visitorId: string;
      type: VisitorEventType;
      path?: string;
      botSlug?: string;
      botId?: Types.ObjectId;
      metadata?: Record<string, unknown>;
      createdAt: Date;
    } = {
      visitorId: params.visitorId,
      type: params.type,
      path: params.path,
      botSlug: params.botSlug,
      metadata: params.metadata,
      createdAt: new Date(),
    };

    if (params.botId && Types.ObjectId.isValid(params.botId)) {
      eventDoc.botId = new Types.ObjectId(params.botId);
    }

    await VisitorEvent.create(eventDoc);
  } catch (error) {
    console.error("Failed to log visitor event", error);
  }
}

export type { VisitorEventType };
