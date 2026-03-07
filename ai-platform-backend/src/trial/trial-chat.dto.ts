export interface TrialChatBody {
  botSlug: string;
  message: string;
  visitorId: string;
  userApiKey?: string;
  openaiApiKey?: string;
  apiKey?: string;
}

export function parseTrialChatBody(body: unknown): TrialChatBody | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const botSlug = typeof o.botSlug === 'string' ? o.botSlug.trim() : '';
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  if (!botSlug || !message || !visitorId) return null;
  const userApiKey = typeof o.userApiKey === 'string' ? o.userApiKey.trim() : undefined;
  const openaiApiKey = typeof o.openaiApiKey === 'string' ? o.openaiApiKey.trim() : undefined;
  const apiKey = typeof o.apiKey === 'string' ? o.apiKey.trim() : undefined;
  return { botSlug, message, visitorId, userApiKey, openaiApiKey, apiKey };
}

function formatUtcDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextUtcMidnightIso(date: Date): string {
  const next = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return next.toISOString();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getTrialRateLimitKey(visitorId: string, botId: string, date: Date): string {
  const dayKey = formatUtcDayKey(date);
  return `trial:msg:${visitorId}:${botId}:${dayKey}`;
}

export function getTrialRateLimitWindowMs(): number {
  return MS_PER_DAY;
}
