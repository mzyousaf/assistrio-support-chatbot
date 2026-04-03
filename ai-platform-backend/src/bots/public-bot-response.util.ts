export interface PublicBotListItemResponse {
  id: string;
  name: string;
  slug: string;
  visibility: 'public';
  accessKey: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  exampleQuestions: string[];
  chatUI?: {
    primaryColor?: string;
    backgroundStyle?: string;
    bubbleBorderRadius?: number;
    launcherPosition?: string;
    showBranding?: boolean;
    timePosition?: 'top' | 'bottom';
  };
  createdAt: string;
}

export interface PublicBotDetailResponse {
  id: string;
  slug: string;
  name: string;
  visibility: 'public';
  accessKey: string;
  shortDescription: string;
  /** Long-form Markdown for gallery / detail pages. */
  description?: string;
  category?: string;
  avatarEmoji: string;
  imageUrl: string;
  welcomeMessage?: string;
  chatUI?: unknown;
  faqs: Array<{ question: string; answer: string }>;
  exampleQuestions: string[];
}

function nonEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalNonEmpty(value: unknown): string | undefined {
  const v = nonEmpty(value);
  return v ? v : undefined;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((v) => nonEmpty(v)).filter(Boolean)
    : [];
}

function toFaqArray(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const q = nonEmpty((entry as { question?: unknown }).question);
      const a = nonEmpty((entry as { answer?: unknown }).answer);
      if (!q && !a) return null;
      return { question: q, answer: a };
    })
    .filter((entry): entry is { question: string; answer: string } => entry !== null);
}

export function shapePublicBotListItem(raw: unknown): PublicBotListItemResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = nonEmpty(row.id);
  const name = nonEmpty(row.name);
  const slug = nonEmpty(row.slug);
  const createdAt = nonEmpty(row.createdAt);
  const accessKey = nonEmpty(row.accessKey);
  if (!id || !name || !slug || !createdAt || !accessKey) return null;
  if (row.visibility !== 'public') return null;
  return {
    id,
    name,
    slug,
    visibility: 'public',
    accessKey,
    shortDescription: optionalNonEmpty(row.shortDescription),
    category: optionalNonEmpty(row.category),
    avatarEmoji: optionalNonEmpty(row.avatarEmoji),
    imageUrl: optionalNonEmpty(row.imageUrl),
    exampleQuestions: toStringArray(row.exampleQuestions),
    chatUI:
      row.chatUI && typeof row.chatUI === 'object'
        ? (row.chatUI as PublicBotListItemResponse['chatUI'])
        : undefined,
    createdAt,
  };
}

export function shapePublicBotDetail(raw: unknown): PublicBotDetailResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = nonEmpty(row.id);
  const slug = nonEmpty(row.slug);
  const name = nonEmpty(row.name);
  const accessKey = nonEmpty(row.accessKey);
  if (!id || !slug || !name || !accessKey) return null;
  if (row.visibility !== 'public') return null;
  return {
    id,
    slug,
    name,
    visibility: 'public',
    accessKey,
    shortDescription: nonEmpty(row.shortDescription),
    description: optionalNonEmpty(row.description),
    category: optionalNonEmpty(row.category),
    avatarEmoji: nonEmpty(row.avatarEmoji) || '💬',
    imageUrl: nonEmpty(row.imageUrl),
    welcomeMessage: optionalNonEmpty(row.welcomeMessage),
    chatUI: row.chatUI,
    faqs: toFaqArray(row.faqs),
    exampleQuestions: toStringArray(row.exampleQuestions),
  };
}

