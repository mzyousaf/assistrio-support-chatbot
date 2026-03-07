export interface CreateTrialBotFields {
  botName: string;
  email: string;
  description?: string;
  visitorId: string;
  faqs?: string;
}

export interface ParsedFaq {
  question: string;
  answer: string;
}

export function toSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'trial-bot';
}

export function parseFaqs(faqs: string | undefined): ParsedFaq[] {
  if (typeof faqs !== 'string' || !faqs.trim()) return [];
  try {
    const arr = JSON.parse(faqs) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (it: unknown) =>
          it &&
          typeof it === 'object' &&
          typeof (it as { question?: unknown }).question === 'string' &&
          typeof (it as { answer?: unknown }).answer === 'string',
      )
      .map((it: { question: string; answer: string }) => ({
        question: it.question.trim(),
        answer: it.answer.trim(),
      }))
      .filter((it) => it.question && it.answer);
  } catch {
    return [];
  }
}

export function parseCreateTrialBotBody(body: unknown): CreateTrialBotFields | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const botName = typeof o.botName === 'string' ? o.botName.trim() : '';
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  if (!botName || !visitorId) return null;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);
  if (!emailValid) return null;
  const description = typeof o.description === 'string' ? o.description.trim() : undefined;
  const faqs = typeof o.faqs === 'string' ? o.faqs : undefined;
  return { botName, email, description, visitorId, faqs };
}
