import { Types } from 'mongoose';
import type { VisitorEventType } from '../models';

/**
 * DTO for **ingestion** `POST /api/analytics/track` only — not a read API, not a PV dashboard contract.
 * Platform visitor **reads** use `/api/public/visitor-quota/*`, `/api/public/visitor-bot/*`.
 *
 * @see docs/ANALYTICS_BOUNDARIES.md
 * @see docs/PV_SAFE_PUBLIC_APIS.md
 */

/** Keep in sync with `VisitorEventType` in `visitor-event.schema.ts` */
const VISITOR_EVENT_TYPES: VisitorEventType[] = [
  'page_view',
  'demo_chat_started',
  'trial_bot_created',
  'trial_chat_started',
  'cta_clicked',
  'demo_opened',
  'trial_create_started',
  'trial_create_succeeded',
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
  platformVisitorId: string;
  type: VisitorEventType;
  path?: string;
  botSlug?: string;
  botId?: string;
  metadata?: Record<string, unknown>;
}

export function parseTrackPayload(body: unknown): TrackAnalyticsPayload | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const platformVisitorId =
    typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
  const legacyVisitorId =
    typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const resolvedVisitorId = platformVisitorId || legacyVisitorId;
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
    platformVisitorId: resolvedVisitorId,
    type: type as VisitorEventType,
    path,
    botSlug,
    botId,
    metadata,
  };
}
