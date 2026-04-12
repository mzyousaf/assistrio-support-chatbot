import { Types } from 'mongoose';
import type { VisitorEventType } from '../models';

/** DTO for **ingestion** `POST /api/analytics/track` only — not a read API, not a PV dashboard contract. */

/** Keep in sync with `VisitorEventType` in `visitor-event.schema.ts` */
const VISITOR_EVENT_TYPES: VisitorEventType[] = [
  'page_view',
  'demo_chat_started',
  'cta_clicked',
  'demo_opened',
  'snippet_copied',
  'stable_id_copied',
  'reconnect_submitted',
  'reconnect_succeeded',
  'website_register_started',
  'website_register_succeeded',
  'widget_runtime_opened',
  'quota_viewed',
];

export interface TrackAnalyticsPayload {
  visitorId: string;
  type: VisitorEventType;
  path?: string;
  botSlug?: string;
  botId?: string;
  metadata?: Record<string, unknown>;
}

export function parseTrackPayload(body: unknown): TrackAnalyticsPayload | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const visitorId =
    typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const legacyPlatformVisitorId =
    typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
  const resolvedVisitorId = visitorId || legacyPlatformVisitorId;
  if (!resolvedVisitorId) return null;
  const type = o.type;
  if (typeof type !== 'string' || !VISITOR_EVENT_TYPES.includes(type as VisitorEventType)) {
    return null;
  }
  const path = typeof o.path === 'string' ? o.path : undefined;
  const botSlug = typeof o.botSlug === 'string' ? o.botSlug : undefined;
  let botId: string | undefined;
  if (o.botId !== undefined && o.botId !== null) {
    const b = String(o.botId);
    if (Types.ObjectId.isValid(b)) botId = b;
    else return null;
  }
  let metadata: Record<string, unknown> | undefined;
  if (o.metadata != null && typeof o.metadata === 'object' && !Array.isArray(o.metadata)) {
    metadata = o.metadata as Record<string, unknown>;
  }
  return {
    visitorId: resolvedVisitorId,
    type: type as VisitorEventType,
    path,
    botSlug,
    botId,
    metadata,
  };
}
