import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import OpenAI from 'openai';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { ASSISTRIO_EMBED_ALLOWED_DOMAINS } from './assistrio-embed-allowed-domains';

/** Max showcase agents a superadmin may have created (pack API). */
export const SHOWCASE_AGENTS_PACK_MAX_PER_USER = 30;
/** Max agents per single API request. */
export const SHOWCASE_AGENTS_PACK_MAX_PER_REQUEST = 30;

const BRAND_COLORS = [
  '#0D9488',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#059669',
  '#4F46E5',
  '#B45309',
  '#0F766E',
  '#1E40AF',
  '#BE185D',
  '#047857',
  '#C2410C',
  '#7E22CE',
  '#0E7490',
  '#B91C1C',
  '#15803D',
  '#A16207',
  '#4338CA',
] as const;

/** Extra candidates when palette + existing colors collide. */
const EXTENDED_ACCENT_POOL = [
  '#D97706',
  '#65A30D',
  '#0891B2',
  '#E11D48',
  '#4D7C0F',
  '#7C2D12',
  '#5B21B6',
  '#14532D',
  '#9D174D',
  '#164E63',
  '#854D0E',
  '#831843',
  '#312E81',
  '#365314',
] as const;

const VERTICALS = [
  'SaaS',
  'E-commerce',
  'Customer support',
  'Healthcare',
  'Finance',
  'Education',
  'HR',
  'Legal',
  'Travel',
  'Fitness',
  'Marketing',
  'General',
] as const;

/** Hostnames allowed for AI-provided avatar URLs (HTTPS only; verified with a real request). */
const AVATAR_IMAGE_HOST_ALLOWLIST = new Set([
  'i.pravatar.cc',
  'images.unsplash.com',
  'images.pexels.com',
  'picsum.photos',
  'ui-avatars.com',
  'api.dicebear.com',
  'avatars.githubusercontent.com',
  'lh3.googleusercontent.com',
  'robohash.org',
  'cdn-icons-png.flaticon.com',
  'res.cloudinary.com',
]);

type GeneratedPack = {
  name: string;
  shortDescription: string;
  description: string;
  welcomeMessage: string;
  category: string;
  exampleQuestions: string[];
  personality: Record<string, unknown>;
  markdownDoc: string;
  plainTextDoc: string;
  internalNotes: string;
  quickLinks: Array<{ text: string; route: string; icon?: string }>;
  faqs: Array<{ question: string; answer: string }>;
  avatarImageUrl?: string;
};

function slugifyBase(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizeHexForCompare(hex: string): string | null {
  const t = hex.trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h.toLowerCase();
}

function pickUniqueAccentColor(usedNormalized: Set<string>): string {
  const pool = [...BRAND_COLORS, ...EXTENDED_ACCENT_POOL];
  for (const c of pool) {
    const n = normalizeHexForCompare(c);
    if (n && !usedNormalized.has(n)) {
      usedNormalized.add(n);
      return c;
    }
  }
  for (let h = 0; h < 360; h += 9) {
    const [r, g, b] = hslToRgb(h, 0.55, 0.42);
    const c = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
    const n = normalizeHexForCompare(c);
    if (n && !usedNormalized.has(n)) {
      usedNormalized.add(n);
      return c;
    }
  }
  const fallback = '#' + randomBytes(3).toString('hex');
  const n = normalizeHexForCompare(fallback);
  if (n) usedNormalized.add(n);
  return fallback;
}

function hslToRgb(h360: number, s: number, l: number): [number, number, number] {
  const h = (((h360 % 360) + 360) % 360) / 360;
  const hue2rgb = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function ensureBotNameHasSpaces(name: string, vertical: string): string {
  const t = name.trim().slice(0, 120);
  if (/\s/.test(t)) return t;
  const base = t || `${vertical} Assistant`;
  return `${base} Demo Assistant`.slice(0, 120);
}

function nameKeyForUniqueness(name: string): string {
  return name.trim().toLowerCase();
}

/** Ensures display name is unique among `used` (case-insensitive); appends ` (2)`, ` (3)`, … as needed. */
function allocateUniqueBotName(base: string, used: Set<string>, maxLen = 120): string {
  const stem = base.trim().slice(0, maxLen) || 'Assistant';
  let n = 1;
  let candidate = stem;
  while (used.has(nameKeyForUniqueness(candidate))) {
    n += 1;
    const suffix = ` (${n})`;
    const maxStem = Math.max(1, maxLen - suffix.length);
    candidate = `${stem.slice(0, maxStem)}${suffix}`.slice(0, maxLen);
  }
  used.add(nameKeyForUniqueness(candidate));
  return candidate;
}

function normalizeFaqsFromUnknown(raw: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ question: string; answer: string }> = [];
  for (const x of raw) {
    if (x == null || typeof x !== 'object') continue;
    const q = String((x as { question?: unknown }).question ?? '').trim();
    const a = String((x as { answer?: unknown }).answer ?? '').trim();
    if (q && a) out.push({ question: q.slice(0, 500), answer: a.slice(0, 2000) });
    if (out.length >= 8) break;
  }
  return out;
}

function buildMarkdownFaqDoc(
  name: string,
  faqs: Array<{ question: string; answer: string }>,
): string {
  const lines = [
    `# ${name} — FAQ`,
    '',
    'Common questions visitors ask this assistant (also indexed as structured FAQs).',
    '',
  ];
  for (const f of faqs) {
    lines.push(`## ${f.question}`, '', f.answer, '');
  }
  return lines.join('\n').trim() + '\n';
}

function ensureDetailedMarkdownDescription(desc: string, name: string, vertical: string): string {
  const t = desc.trim();
  if (t.length >= 400 && /^#+\s/m.test(t)) return t.slice(0, 8000);
  const body =
    t.length >= 120
      ? t
      : `## Overview\n\nThis assistant represents a fictional B2B product in **${vertical}**. It demonstrates how Assistrio can answer questions from your knowledge base, documents, and FAQs.\n\n## What it does\n\n- Answers common questions with short, grounded replies\n- Surfaces pricing and policy hints from your uploaded content\n- Escalates edge cases when documented`;
  return [
    `# ${name}`,
    '',
    `**Vertical:** ${vertical}`,
    '',
    body,
    '',
    '## Audience',
    '',
    'Prospects, customers, and internal teams who need quick answers without opening a ticket.',
    '',
    '## Scope',
    '',
    'Responses are limited to the knowledge you provide. For account-specific or legal advice, visitors may be directed to your team.',
    '',
  ]
    .join('\n')
    .slice(0, 8000);
}

function isAllowedAvatarHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (AVATAR_IMAGE_HOST_ALLOWLIST.has(h)) return true;
  if (h.endsWith('.pravatar.cc')) return true;
  if (h.endsWith('.unsplash.com')) return true;
  return false;
}

async function verifyHttpsPublicImageUrl(urlStr: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (!isAllowedAvatarHost(u.hostname)) return false;

  const tryReq = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(urlStr, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: method === 'GET' ? { Range: 'bytes=0-2048' } : undefined,
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok && !(method === 'HEAD' && res.status === 405)) return false;
    return ct.startsWith('image/');
  };

  try {
    if (await tryReq('HEAD')) return true;
    return await tryReq('GET');
  } catch {
    return false;
  }
}

@Injectable()
export class ShowcaseAgentsPackService {
  constructor(
    private readonly config: ConfigService,
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
  ) {}

  private getOpenAI(): OpenAI | null {
    const apiKey = (this.config.get<string>('openaiApiKey') || '').trim();
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  }

  private async generateWithAi(vertical: string, accentColor: string): Promise<GeneratedPack | null> {
    const openai = this.getOpenAI();
    if (!openai) return null;

    const userPrompt = `Create a distinct fictional B2B support agent for vertical: "${vertical}".
Brand accent color (for UI only): ${accentColor}.
Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "name": "string (must contain at least one space; 2–6 words; unique product/company feel)",
  "shortDescription": "string (tagline, max 120 chars)",
  "description": "string (Markdown only, detailed): use headings (##), bullet lists, and bold where helpful. Include sections: ## Product overview, ## Key capabilities, ## Who it is for, ## Pricing & plans (fictional but plausible), ## Policies & limits. Aim for 500–2000 words of substantive content.",
  "welcomeMessage": "string (friendly, <= 400 chars)",
  "category": "string (1-3 words)",
  "exampleQuestions": ["3-4 short user questions"],
  "personality": { "tone": "string", "style": "string", "constraints": "string" },
  "faqs": [ { "question": "string", "answer": "string" }, ... 4 to 6 items ],
  "markdownDoc": "string (markdown, 400–900 words): deep product overview, features, integrations — fictional but coherent; do not duplicate the full FAQ list verbatim",
  "plainTextDoc": "string (plain text, 200–500 words): bullet-style facts, SLAs, and policies",
  "internalNotes": "string (200–500 words): internal support KB — escalation, tone, what not to promise — not shown as the main chat blurb",
  "avatarImageUrl": "string (optional): HTTPS URL to a square-friendly avatar image from a public host such as i.pravatar.cc, images.unsplash.com, ui-avatars.com, or api.dicebear.com",
  "quickLinks": [ { "text": "string", "route": "string path like /pricing or /docs", "icon": "optional lucide id e.g. link-2 or book-open" } ]
}
Use 3-4 quickLinks with sensible paths. Routes must start with /.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.85,
        max_tokens: 8192,
        messages: [
          {
            role: 'system',
            content:
              'You output only compact JSON. No markdown code fences. All strings in English. Each request must differ strongly in company name and scenario. Escape newlines inside JSON strings as \\n.',
          },
          { role: 'user', content: userPrompt },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
      const name = typeof parsed.name === 'string' ? parsed.name : '';
      const shortDescription = typeof parsed.shortDescription === 'string' ? parsed.shortDescription : '';
      if (!name || !shortDescription) return null;

      const faqs = normalizeFaqsFromUnknown(parsed.faqs);
      const avatarImageUrl = typeof parsed.avatarImageUrl === 'string' ? parsed.avatarImageUrl.trim() : undefined;

      return {
        name,
        shortDescription,
        description: typeof parsed.description === 'string' ? parsed.description : '',
        welcomeMessage: typeof parsed.welcomeMessage === 'string' ? parsed.welcomeMessage : '',
        category: typeof parsed.category === 'string' ? parsed.category : vertical,
        exampleQuestions: Array.isArray(parsed.exampleQuestions)
          ? parsed.exampleQuestions.filter((q): q is string => typeof q === 'string')
          : [],
        personality:
          parsed.personality != null && typeof parsed.personality === 'object'
            ? (parsed.personality as Record<string, unknown>)
            : {},
        markdownDoc: typeof parsed.markdownDoc === 'string' ? parsed.markdownDoc : '',
        plainTextDoc: typeof parsed.plainTextDoc === 'string' ? parsed.plainTextDoc : '',
        internalNotes: typeof parsed.internalNotes === 'string' ? parsed.internalNotes : '',
        quickLinks: Array.isArray(parsed.quickLinks)
          ? (parsed.quickLinks as Array<{ text: string; route: string; icon?: string }>)
          : [],
        faqs,
        ...(avatarImageUrl ? { avatarImageUrl } : {}),
      };
    } catch {
      return null;
    }
  }

  private fallbackPack(vertical: string, accentColor: string): GeneratedPack {
    const name = `${vertical} Demo Assistant`;
    return {
      name,
      shortDescription: `Helpful AI guide for ${vertical} — ask anything.`,
      description: [
        `# ${name}`,
        '',
        `**Vertical:** ${vertical}`,
        '',
        '## Product overview',
        '',
        `This is a demonstration agent for **${vertical}**. It answers common questions using uploaded documents, FAQs, and internal notes.`,
        '',
        '## Key capabilities',
        '',
        '- Grounded answers from your knowledge base',
        '- Short replies with optional source citations',
        '- Quick links to pricing, docs, and contact flows',
        '',
        '## Who it is for',
        '',
        'Teams evaluating Assistrio who want a realistic sample bot without connecting a live product.',
        '',
        '## Pricing & plans (fictional)',
        '',
        '- **Starter**: self-serve knowledge + widget',
        '- **Growth**: SSO, higher limits, analytics',
        '- **Enterprise**: custom terms and support SLAs',
        '',
        '## Policies & limits',
        '',
        'Do not invent discounts or legal commitments. Prefer documented facts and safe handoff to humans when unsure.',
        '',
      ].join('\n'),
      welcomeMessage: `Hi! I’m here to help with ${vertical} questions. What would you like to know?`,
      category: vertical,
      exampleQuestions: [
        'What can you help me with?',
        'How do I get started?',
        'Where can I find pricing?',
      ],
      personality: {
        tone: 'professional',
        style: 'concise',
        constraints: 'Stay within documented knowledge; offer short replies.',
      },
      markdownDoc: `# ${name}\n\n## Overview\nDemo knowledge for ${vertical}.\n\n## Features\n- Fast answers\n- Clear guidance\n`,
      plainTextDoc: `${name} — ${vertical} demo.\nFacts: This is placeholder knowledge for ingestion testing.`,
      internalNotes: `Internal: escalate billing disputes to human. Accent color reference: ${accentColor}.`,
      faqs: [
        {
          question: `What does this ${vertical} demo assistant do?`,
          answer: 'It answers questions using your uploaded documents, FAQs, and notes. It is a sample for testing retrieval and widget behavior.',
        },
        {
          question: 'How do I get pricing?',
          answer: 'Use the Pricing quick link or ask about plans. For custom quotes, route visitors to your sales team.',
        },
        {
          question: 'Can I trust medical or legal advice here?',
          answer: 'No. This is a demo. For regulated advice, always connect users with qualified professionals.',
        },
        {
          question: 'How do I contact a human?',
          answer: 'Use Contact or your company’s support channels. The bot should offer escalation when confidence is low.',
        },
      ],
      quickLinks: [
        { text: 'Pricing', route: '/pricing', icon: 'tag' },
        { text: 'Docs', route: '/docs', icon: 'book-open' },
        { text: 'Contact', route: '/contact', icon: 'mail' },
      ],
    };
  }

  private async resolveVerifiedAvatarUrl(
    gen: GeneratedPack,
    nameForAvatar: string,
    slug: string,
  ): Promise<string | undefined> {
    const candidates: string[] = [];
    if (gen.avatarImageUrl) candidates.push(gen.avatarImageUrl);
    candidates.push(`https://i.pravatar.cc/300?u=${encodeURIComponent(slug)}`);
    candidates.push(
      `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar.slice(0, 40))}&size=256&background=random&color=fff`,
    );
    candidates.push(
      `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(slug)}`,
    );

    for (const url of candidates) {
      if (await verifyHttpsPublicImageUrl(url)) return url;
    }
    return undefined;
  }

  async runPack(params: {
    count: number;
    createdByUserId: Types.ObjectId;
    workspaceId: Types.ObjectId;
  }): Promise<{
    created: Array<{ botId: string; slug: string; name: string; docsQueued: number; aiGenerated: boolean }>;
    errors: Array<{ index: number; error: string }>;
    skippedDueToCap: number;
  }> {
    const count = Math.floor(Number(params.count));
    if (!Number.isFinite(count) || count < 1) {
      throw new Error('count must be between 1 and ' + SHOWCASE_AGENTS_PACK_MAX_PER_REQUEST);
    }
    if (count > SHOWCASE_AGENTS_PACK_MAX_PER_REQUEST) {
      throw new Error('count exceeds max per request (' + SHOWCASE_AGENTS_PACK_MAX_PER_REQUEST + ')');
    }

    const creatorId = params.createdByUserId.toString();
    const existing = await this.botsService.countShowcaseBotsForCreator(creatorId);
    if (existing >= SHOWCASE_AGENTS_PACK_MAX_PER_USER) {
      return { created: [], errors: [], skippedDueToCap: count };
    }
    const allowed = Math.min(count, SHOWCASE_AGENTS_PACK_MAX_PER_USER - existing);

    const created: Array<{ botId: string; slug: string; name: string; docsQueued: number; aiGenerated: boolean }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    const existingColors = await this.botsService.listShowcasePrimaryColorsForCreator(creatorId);
    const usedColorKeys = new Set<string>();
    for (const c of existingColors) {
      const n = normalizeHexForCompare(c);
      if (n) usedColorKeys.add(n);
    }

    const existingNames = await this.botsService.listShowcaseNamesForCreator(creatorId);
    const usedNames = new Set<string>();
    for (const n of existingNames) {
      const k = nameKeyForUniqueness(n);
      if (k) usedNames.add(k);
    }

    for (let i = 0; i < allowed; i++) {
      const vertical = VERTICALS[i % VERTICALS.length];
      const accent = pickUniqueAccentColor(usedColorKeys);
      let gen = await this.generateWithAi(vertical, accent);
      const aiGenerated = gen != null;
      if (!gen) gen = this.fallbackPack(vertical, accent);

      gen.name = ensureBotNameHasSpaces(gen.name, vertical);
      gen.name = allocateUniqueBotName(gen.name, usedNames, 120);
      gen.description = ensureDetailedMarkdownDescription(gen.description, gen.name, vertical);
      if (!gen.faqs || gen.faqs.length < 3) {
        const fb = this.fallbackPack(vertical, accent);
        gen.faqs = fb.faqs;
      }

      const baseSlug = slugifyBase(gen.name || `showcase-${vertical}`) || 'showcase';
      let slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
      for (let attempt = 0; attempt < 8; attempt++) {
        const clash = await this.botsService.findOneBySlug(slug);
        if (!clash) break;
        slug = `${baseSlug}-${randomBytes(4).toString('hex')}`;
      }

      try {
        const imageUrl = await this.resolveVerifiedAvatarUrl(gen, gen.name, slug);

        const bot = await this.botsService.create({
          name: gen.name.slice(0, 120),
          slug,
          type: 'showcase',
          status: 'published',
          isPublic: true,
          visibility: 'public',
          category: gen.category.slice(0, 80),
          shortDescription: gen.shortDescription.slice(0, 500),
          description: gen.description.slice(0, 8000),
          welcomeMessage: gen.welcomeMessage.slice(0, 2000),
          exampleQuestions: gen.exampleQuestions.filter(Boolean).slice(0, 6).map((q) => String(q).slice(0, 200)),
          personality: gen.personality,
          allowedDomains: [...ASSISTRIO_EMBED_ALLOWED_DOMAINS],
          visitorMultiChatEnabled: true,
          visitorMultiChatMax: 5,
          includeNotesInKnowledge: true,
          createdByUserId: params.createdByUserId,
          ownerUserId: params.createdByUserId,
          workspaceId: params.workspaceId,
          ...(imageUrl ? { imageUrl } : {}),
          chatUI: {
            primaryColor: accent,
            backgroundStyle: 'light',
            bubbleBorderRadius: 20,
            launcherPosition: 'bottom-right',
            timePosition: 'top',
            showBranding: true,
            showSources: true,
            showMenuQuickLinks: true,
            ...(imageUrl
              ? {
                  launcherIcon: 'bot-avatar' as const,
                  launcherAvatarUrl: imageUrl,
                }
              : {}),
            menuQuickLinks: (Array.isArray(gen.quickLinks) ? gen.quickLinks : [])
              .filter((l) => l && l.text && l.route)
              .slice(0, 10)
              .map((l) => ({
                text: String(l.text).slice(0, 80),
                route: String(l.route).slice(0, 200),
                ...(l.icon ? { icon: String(l.icon).slice(0, 40) } : {}),
              })),
            menuQuickLinksMenuIcon: 'link-2',
          },
          config: {
            temperature: 0.35,
            responseLength: 'short',
            maxTokens: 384,
          },
          leadCapture: { enabled: false, fields: [] },
          categories: [],
        });

        const botId =
          (bot as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((bot as { _id?: unknown })._id);

        await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botId, gen.internalNotes);
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botId, gen.faqs);
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botId);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botId);

        const faqMarkdownDoc = buildMarkdownFaqDoc(gen.name, gen.faqs);
        let docsQueued = 0;
        const docs: Array<{ title: string; text: string }> = [
          { title: 'Product overview.md', text: gen.markdownDoc },
          { title: 'FAQs.md', text: faqMarkdownDoc },
          { title: 'Reference facts.txt', text: gen.plainTextDoc },
        ];
        for (const d of docs) {
          const doc = await this.documentsService.create({
            botId,
            title: d.title,
            sourceType: 'manual',
            status: 'queued',
            text: d.text,
          });
          const docId =
            (doc as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((doc as { _id?: unknown })._id);
          await this.ingestionService.createQueuedJob(botId, docId);
          docsQueued += 1;
        }

        created.push({
          botId,
          slug,
          name: gen.name,
          docsQueued,
          aiGenerated,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ index: i, error: msg });
      }
    }

    return { created, errors, skippedDueToCap: count - allowed };
  }
}
