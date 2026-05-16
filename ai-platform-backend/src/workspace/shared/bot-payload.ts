import type {
  BotChatUI,
  BotConfig,
  BotLeadCaptureV2,
  BotLeadField,
  BotPersonality,
  BotTranslationSettings,
} from '../../models/bot.schema';
import type { LeadFieldType } from '../../models/bot.schema';
import type { AllowedOrigin } from '../../bots/origin-validation.util';
import { normalizeUserAllowedOriginInput } from '../../bots/origin-validation.util';
import { normalizeVisitorMultiChatMax } from '../../bots/visitor-multi-chat.util';
import {
  BOT_FIELD_MAX,
  clampStr,
  clampStrUtf8Bytes,
  KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES,
  KNOWLEDGE_ITEM_BODY_MAX_UTF8_BYTES,
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
  KNOWLEDGE_QA_MAX,
  KNOWLEDGE_QA_QUESTIONS_MAX,
  KNOWLEDGE_SNIPPETS_MAX,
  KNOWLEDGE_TABLES_MAX,
  KNOWLEDGE_TABLE_MAX_COLUMNS,
  KNOWLEDGE_TABLE_MAX_ROWS,
  LEAD_CAPTURE_FIELDS_MAX,
  clampFaqQuestionsUtf8Combined,
  utf8ByteLength,
} from './bot-field-limits';
import { MAX_DATASHEET_IMPORT_BYTES } from '../../documents/bot-document-upload.constants';
import { DEFAULT_KB_FIELD_LIMITS } from '../../knowledge/knowledge-plan-limits';
import {
  normalizeKnowledgeReplyPrioritySettings,
  type KnowledgeReplyPrioritySettings,
} from '../../knowledge/knowledge-reply-priority.util';
import {
  assertFaqsWithinPlanLimits,
  assertSnippetsWithinPlanLimits,
  assertSuggestionsWithinPlanLimits,
} from '../../knowledge/kb-section-plan-limit.util';
import { normalizeQuickLinkIcon } from './quick-link-icon-ids';
import { type ExampleQuestionDoc, normalizeExampleQuestionsForStorage } from './example-questions.util';
import { HttpException, HttpStatus } from '@nestjs/common';

const LEAD_TYPES: LeadFieldType[] = ['text', 'email', 'phone', 'number', 'url'];

function slugifyKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function ensureUniqueKey(base: string, used: Set<string>): string {
  const n = slugifyKey(base) || 'field';
  if (!used.has(n)) {
    used.add(n);
    return n;
  }
  let i = 2;
  while (used.has(`${n}-${i}`)) i++;
  const k = `${n}-${i}`;
  used.add(k);
  return k;
}

function normalizeFields(input: unknown): BotLeadField[] {
  if (!Array.isArray(input)) return [];
  const used = new Set<string>();
  const out: BotLeadField[] = [];
  for (const field of input) {
    if (out.length >= LEAD_CAPTURE_FIELDS_MAX) break;
    if (!field || typeof field !== 'object') continue;
    const o = field as Record<string, unknown>;
    const labelRaw = clampStr(typeof o.label === 'string' ? o.label.trim() : '', BOT_FIELD_MAX.leadFieldLabel);
    const keyRaw = typeof o.key === 'string' ? o.key.trim() : '';
    if (!labelRaw && !keyRaw) continue;
    const typeRaw = typeof o.type === 'string' ? o.type : 'text';
    const type: LeadFieldType = LEAD_TYPES.includes(typeRaw as LeadFieldType) ? (typeRaw as LeadFieldType) : 'text';
    const key = ensureUniqueKey(keyRaw || labelRaw, used);
    const aliases = Array.isArray(o.aliases)
      ? (o.aliases as unknown[]).map((a) => String(a).trim().toLowerCase()).filter(Boolean)
      : undefined;
    out.push({
      key,
      label: labelRaw || key.replace(/-/g, ' '),
      type,
      required: o.required !== false,
      ...(o.disabled === true ? { disabled: true } : {}),
      ...(aliases?.length ? { aliases } : {}),
    });
  }
  return out;
}

function normalizeLeadCapture(input: unknown): BotLeadCaptureV2 {
  if (!input || typeof input !== 'object') return { enabled: false, fields: [] };
  const o = input as Record<string, unknown>;
  const fields = normalizeFields(o.fields);
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : fields.length > 0;
  const askStrategy = ['soft', 'balanced', 'direct'].includes(String(o.askStrategy ?? '')) ? (o.askStrategy as BotLeadCaptureV2['askStrategy']) : undefined;
  const politeMode = typeof o.politeMode === 'boolean' ? o.politeMode : undefined;
  const captureMode = ['chat', 'form', 'hybrid'].includes(String(o.captureMode ?? '')) ? (o.captureMode as BotLeadCaptureV2['captureMode']) : undefined;
  const extra = { askStrategy, politeMode, captureMode };
  if (fields.length > 0) return { enabled, fields, ...extra };
  if ('collectName' in o || 'collectEmail' in o || 'collectPhone' in o) {
    const leg = o as { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean; enabled?: boolean };
    const legacyFields: BotLeadField[] = [];
    if (leg.collectName !== false) legacyFields.push({ key: 'name', label: 'Name', type: 'text', required: true });
    if (leg.collectEmail !== false) legacyFields.push({ key: 'email', label: 'Email', type: 'email', required: true });
    if (leg.collectPhone) legacyFields.push({ key: 'phone', label: 'Phone', type: 'phone', required: true });
    return { enabled: leg.enabled === true, fields: legacyFields, ...extra };
  }
  return { enabled: false, fields: [], ...extra };
}

export type NormalizedFaqV2 = {
  title: string;
  questions: string[];
  question: string;
  answer: string;
  active: boolean;
};

function normalizeFaqs(input: unknown): NormalizedFaqV2[] {
  const parsed = typeof input === 'string' ? (() => { try { return JSON.parse(input); } catch { return []; } })() : input;
  if (!Array.isArray(parsed)) return [];
  const L = DEFAULT_KB_FIELD_LIMITS;
  const out: NormalizedFaqV2[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = clampStrUtf8Bytes(String(o.title ?? '').trim(), L.faqTitleMaxBytes);
    const answer = clampStrUtf8Bytes(String(o.answer ?? '').trim(), L.faqAnswerMaxBytes);
    const legacyQ = String(o.question ?? '').trim();
    let questions: string[] = [];
    if (Array.isArray(o.questions)) {
      questions = o.questions.map((q) => String(q ?? '').trim()).filter(Boolean);
    }
    if (legacyQ) questions = [legacyQ, ...questions.filter((q) => q !== legacyQ)];
    questions = [...new Set(questions)].slice(0, KNOWLEDGE_QA_QUESTIONS_MAX);
    questions = clampFaqQuestionsUtf8Combined(questions, L.faqQuestionMaxBytes);
    if (!answer.trim()) continue;
    if (questions.length === 0 && !title.trim()) continue;
    if (questions.length === 0) questions = [title || 'Question'];
    const question = questions[0] ?? '';
    out.push({
      title,
      questions,
      question,
      answer,
      active: o.active === false ? false : true,
    });
    if (out.length >= KNOWLEDGE_QA_MAX) break;
  }
  return out;
}

function normalizeKnowledgeSnippets(
  input: unknown,
): Array<{ title: string; snippet: string; active: boolean }> {
  const parsed = typeof input === 'string' ? (() => { try { return JSON.parse(input); } catch { return []; } })() : input;
  if (!Array.isArray(parsed)) return [];
  const L = DEFAULT_KB_FIELD_LIMITS;
  const out: Array<{ title: string; snippet: string; active: boolean }> = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = clampStrUtf8Bytes(
      String(o.title ?? o.label ?? '').trim(),
      L.snippetTitleMaxBytes,
    ) || 'Snippet';
    const snippet = clampStrUtf8Bytes(
      String(o.snippet ?? o.description ?? '').trim(),
      L.snippetDescriptionMaxBytes,
    );
    if (!snippet) continue;
    out.push({ title, snippet, active: o.active === false ? false : true });
    if (out.length >= KNOWLEDGE_SNIPPETS_MAX) break;
  }
  return out;
}

function datasheetNormalizedGridUtf8Bytes(sheet: { title: string; columns: string[]; rows: string[][] }): number {
  let n = utf8ByteLength(sheet.title ?? '');
  for (const c of sheet.columns ?? []) n += utf8ByteLength(String(c ?? ''));
  for (const r of sheet.rows ?? []) for (const cell of r ?? []) n += utf8ByteLength(String(cell ?? ''));
  return n;
}

function normalizeKnowledgeDatasheets(
  input: unknown,
): Array<{
  title: string;
  columns: string[];
  rows: string[][];
  active: boolean;
  importFileSize?: number;
  importFileName?: string;
}> {
  const parsed = typeof input === 'string' ? (() => { try { return JSON.parse(input); } catch { return []; } })() : input;
  if (!Array.isArray(parsed)) return [];
  const out: Array<{
    title: string;
    columns: string[];
    rows: string[][];
    active: boolean;
    importFileSize?: number;
    importFileName?: string;
  }> = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = clampStrUtf8Bytes(String(o.title ?? '').trim(), KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES) || 'Datasheet';
    const colRaw = Array.isArray(o.columns) ? o.columns : [];
    const columns = colRaw
      .slice(0, KNOWLEDGE_TABLE_MAX_COLUMNS)
      .map((c) => clampStr(String(c ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell));
    const rowRaw = Array.isArray(o.rows) ? o.rows : [];
    const rows: string[][] = [];
    for (const r of rowRaw) {
      if (rows.length >= KNOWLEDGE_TABLE_MAX_ROWS) break;
      if (!Array.isArray(r)) continue;
      const row = r
        .slice(0, columns.length)
        .map((c) => clampStr(String(c ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell));
      while (row.length < columns.length) row.push('');
      rows.push(row);
    }
    if (columns.length === 0) continue;
    if (rows.length === 0) {
      rows.push(columns.map(() => ''));
    }
    let importFileSize: number | undefined;
    const rawSz = o.importFileSize;
    if (typeof rawSz === 'number' && Number.isFinite(rawSz) && rawSz >= 0) {
      importFileSize = Math.min(Math.floor(rawSz), MAX_DATASHEET_IMPORT_BYTES);
    }
    const rawFn = o.importFileName;
    const importFileName =
      typeof rawFn === 'string' && rawFn.trim()
        ? clampStr(rawFn.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
        : undefined;
    const gridBytes = datasheetNormalizedGridUtf8Bytes({ title, columns, rows });
    if (gridBytes > KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES) {
      throw new Error(
        `A datasheet exceeds the maximum stored content size (${KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES} UTF-8 bytes). Shorten titles or cells and try again.`,
      );
    }
    out.push({
      title,
      columns,
      rows,
      active: o.active === false ? false : true,
      ...(importFileSize != null ? { importFileSize } : {}),
      ...(importFileName ? { importFileName } : {}),
    });
    if (out.length >= KNOWLEDGE_TABLES_MAX) break;
  }
  return out;
}

function normalizeExampleQuestions(input: unknown): ExampleQuestionDoc[] {
  return normalizeExampleQuestionsForStorage(input);
}

/** FAQ array for `/knowledge/faqs/*` (do not send on `PATCH /bots/:id`). */
export function normalizeWorkspaceKnowledgeFaqsArray(input: unknown): NormalizedFaqV2[] {
  assertFaqsWithinPlanLimits(input);
  return normalizeFaqs(input);
}

/** Snippet array for `/knowledge/snippets/*`. */
export function normalizeWorkspaceKnowledgeSnippetsArray(input: unknown): Array<{
  title: string;
  snippet: string;
  active: boolean;
}> {
  assertSnippetsWithinPlanLimits(input);
  return normalizeKnowledgeSnippets(input);
}

/** Datasheet array for `/knowledge/datasheets/*`. */
export function normalizeWorkspaceKnowledgeDatasheetsArray(input: unknown): Array<{
  title: string;
  columns: string[];
  rows: string[][];
  active: boolean;
  importFileSize?: number;
  importFileName?: string;
}> {
  return normalizeKnowledgeDatasheets(input);
}

/** Full suggestion-chip list for `POST …/knowledge/suggestions/sync`. */
export function normalizeWorkspaceKnowledgeSuggestionsArray(input: unknown): ExampleQuestionDoc[] {
  assertSuggestionsWithinPlanLimits(input);
  return normalizeExampleQuestions(input);
}

/** Legacy plain-text description (`PATCH …/knowledge/description`). */
export function normalizeWorkspaceKnowledgeDescriptionField(input: unknown): string {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpException({ error: 'Invalid body', errorCode: 'invalid_body' }, HttpStatus.BAD_REQUEST);
  }
  const raw = String((input as Record<string, unknown>).knowledgeDescription ?? '').trim();
  return clampStr(raw, BOT_FIELD_MAX.knowledgeDescription);
}

const MENU_QUICK_LINKS_MAX = 10;

const BEHAVIOR_PRESETS = new Set([
  'default', 'support', 'sales', 'technical', 'marketing',
  'consultative', 'teacher', 'empathetic', 'strict',
  'concise', 'creative', 'research', 'executive', 'hospitality',
  'coach', 'analyst', 'storyteller', 'startup', 'journalistic',
  'companion', 'simplifier', 'facilitator', 'advocate', 'negotiator', 'interviewer',
]);

/**
 * Workspace PATCH allowlist. Intentionally excludes `botConfig` / `knowledgeSize` so customers cannot
 * alter plan quotas via `/api/customer/bots` (or shared admin PATCH) until a dedicated internal API exists.
 */
const WORKSPACE_PATCH_RECOGNIZED_KEYS = new Set([
  'name',
  'shortDescription',
  'description',
  'categories',
  'imageUrl',
  'avatarEmoji',
  'avatarSource',
  'knowledgeDescription',
  'knowledgeSnippets',
  'knowledgeDatasheets',
  'knowledgeTables',
  'welcomeMessage',
  'welcomeMessageEnabled',
  'faqs',
  'exampleQuestions',
  'leadCapture',
  'chatUI',
  'personality',
  'config',
  'translationSettings',
  'openaiApiKeyOverride',
  'whisperApiKeyOverride',
  'limitOverrideMessages',
  'visibility',
  'isPublic',
  'status',
  'includeNameInKnowledge',
  'includeTaglineInKnowledge',
  'includeNotesInKnowledge',
  'allowedOrigins',
  'visitorMultiChatEnabled',
  'knowledgeReplyPriority',
]);

function normalizeTranslationSettings(input: unknown): BotTranslationSettings {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const rawEnabled = raw.enabled === true;
  const rawMode = String(raw.mode ?? '').trim().toLowerCase();
  const fixedLanguage =
    typeof raw.fixedLanguage === 'string' && raw.fixedLanguage.trim()
      ? clampStr(raw.fixedLanguage.trim(), BOT_FIELD_MAX.personalityLanguage)
      : undefined;
  let mode: 'english_only' | 'auto' | 'fixed' = 'english_only';
  if (rawEnabled) {
    if (rawMode === 'fixed') mode = 'fixed';
    else if (rawMode === 'auto') mode = 'auto';
  }
  if (mode === 'fixed' && !fixedLanguage) {
    throw new HttpException(
      { error: 'translationSettings.fixedLanguage is required when mode is fixed.' },
      HttpStatus.BAD_REQUEST,
    );
  }
  return {
    enabled: rawEnabled,
    mode,
    ...(mode === 'fixed' && fixedLanguage ? { fixedLanguage } : {}),
    transcriptLanguage: 'english',
  };
}

/** Must use `/api/.../bots/:id/knowledge/*` instead of `PATCH …/bots/:id`. */
const KB_CONTENT_KEYS_BLOCKED_ON_BOT_PATCH = new Set([
  'faqs',
  'knowledgeSnippets',
  'knowledgeDescription',
  'knowledgeDatasheets',
  'knowledgeTables',
  'exampleQuestions',
]);

function normalizeAllowedOriginsFromPayload(input: Record<string, unknown>): AllowedOrigin[] | undefined {
  if (!('allowedOrigins' in input)) return undefined;
  const raw = input.allowedOrigins;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AllowedOrigin[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const originRaw = String(o.origin ?? '').trim();
    const co = normalizeUserAllowedOriginInput(originRaw);
    if (!co || seen.has(co)) continue;
    seen.add(co);
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 120) : undefined;
    const isActive = o.isActive !== false;
    out.push({
      origin: co,
      ...(label ? { label } : {}),
      isActive,
    });
  }
  return out;
}

function normalizeMenuQuickLinks(input: unknown): Array<{ text: string; route: string; icon?: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MENU_QUICK_LINKS_MAX)
    .map((item: unknown) => {
      const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
      if (!o) return null;
      const text = clampStr(typeof o.text === 'string' ? o.text.trim() : '', BOT_FIELD_MAX.menuQuickLinkText);
      const route = clampStr(typeof o.route === 'string' ? o.route.trim() : '', BOT_FIELD_MAX.menuQuickLinkRoute);
      if (!text || !route) return null;
      const icon = normalizeQuickLinkIcon(o.icon);
      return icon ? { text, route, icon } : { text, route };
    })
    .filter((x): x is { text: string; route: string; icon?: string } => x != null);
}

function normalizeUserBubbleStyleInput(v: unknown): 'primary' | 'default' | 'defaultDark' {
  if (v === 'default') return 'default';
  if (v === 'defaultDark') return 'defaultDark';
  return 'primary';
}

function normalizeComposerControlStyleInput(input: Record<string, unknown>): 'brand' | 'default' | 'defaultDark' {
  const s = input.composerControlStyle;
  if (s === 'brand' || s === 'default' || s === 'defaultDark') return s;
  return input.composerControlsUsePrimary === false ? 'default' : 'defaultDark';
}

function normalizeSpeechRecordingWaveStyleInput(input: Record<string, unknown>): 'brand' | 'default' | 'defaultDark' {
  const s = input.speechRecordingWaveStyle;
  if (s === 'brand' || s === 'default' || s === 'defaultDark') return s;
  return 'default';
}

function normalizeScrollChromeStyleInput(input: Record<string, unknown>): 'default' | 'defaultDark' | 'primary' {
  const s = input.scrollChromeStyle;
  if (s === 'default' || s === 'defaultDark' || s === 'primary') return s;
  if (s === 'gray') return 'defaultDark';
  return input.scrollChromeUsesPrimary === false ? 'default' : 'primary';
}

function normalizeScrollToBottomChromeStyleInput(input: Record<string, unknown>): 'default' | 'defaultDark' | 'primary' {
  const s = input.scrollToBottomChromeStyle;
  if (s === 'default' || s === 'defaultDark' || s === 'primary') return s;
  if (s === 'gray') return 'defaultDark';
  return normalizeScrollChromeStyleInput(input);
}

/** Shared chatUI normalizer (full object) for finalize-draft and PATCH when `chatUI` is present. */
export function buildNormalizedChatUI(chatUIInput: Record<string, unknown>): BotChatUI {
  const bubbleRadius =
    typeof chatUIInput.bubbleBorderRadius === 'number' && chatUIInput.bubbleBorderRadius >= 0 && chatUIInput.bubbleBorderRadius <= 32
      ? Math.round(chatUIInput.bubbleBorderRadius)
      : chatUIInput.bubbleStyle === 'squared'
        ? 0
        : 20;
  const timePos =
    chatUIInput.timePosition === 'bottom' || chatUIInput.timePosition === 'bottom-right' ? 'bottom' : 'top';
  const chatPanelBorderWidth =
    typeof chatUIInput.chatPanelBorderWidth === 'number' &&
      chatUIInput.chatPanelBorderWidth >= 0 &&
      chatUIInput.chatPanelBorderWidth <= 5
      ? Math.round(chatUIInput.chatPanelBorderWidth)
      : 1;
  const menuQuickLinksMenuIcon = normalizeQuickLinkIcon(chatUIInput.menuQuickLinksMenuIcon);
  return {
    primaryColor: typeof chatUIInput.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(chatUIInput.primaryColor.trim()) ? chatUIInput.primaryColor.trim() : '#14B8A6',
    backgroundStyle: chatUIInput.backgroundStyle === 'auto' || chatUIInput.backgroundStyle === 'light' || chatUIInput.backgroundStyle === 'dark' ? chatUIInput.backgroundStyle as BotChatUI['backgroundStyle'] : 'light',
    bubbleBorderRadius: bubbleRadius,
    chatPanelBorderWidth,
    launcherPosition: chatUIInput.launcherPosition === 'bottom-left' || chatUIInput.launcherPosition === 'bottom-right' ? chatUIInput.launcherPosition as BotChatUI['launcherPosition'] : 'bottom-right',
    shadowIntensity:
      chatUIInput.shadowIntensity === 'none' ||
        chatUIInput.shadowIntensity === 'low' ||
        chatUIInput.shadowIntensity === 'medium' ||
        chatUIInput.shadowIntensity === 'high'
        ? (chatUIInput.shadowIntensity as BotChatUI['shadowIntensity'])
        : 'medium',
    showChatBorder: chatUIInput.showChatBorder !== false,
    chatPanelBorderColor: chatUIInput.chatPanelBorderColor === 'default' ? 'default' : 'primary',
    launcherIcon:
      chatUIInput.launcherIcon === 'bot-avatar' || chatUIInput.launcherIcon === 'custom' ? chatUIInput.launcherIcon : 'default',
    launcherAvatarUrl:
      typeof chatUIInput.launcherAvatarUrl === 'string' ? chatUIInput.launcherAvatarUrl.trim() || undefined : undefined,
    launcherAvatarRingWidth:
      typeof chatUIInput.launcherAvatarRingWidth === 'number' &&
        chatUIInput.launcherAvatarRingWidth >= 0 &&
        chatUIInput.launcherAvatarRingWidth <= 30
        ? Math.round(chatUIInput.launcherAvatarRingWidth)
        : 18,
    launcherSize:
      typeof chatUIInput.launcherSize === 'number' && chatUIInput.launcherSize >= 32 && chatUIInput.launcherSize <= 96
        ? Math.round(chatUIInput.launcherSize)
        : 48,
    launcherWhenOpen:
      chatUIInput.launcherWhenOpen === 'close' || chatUIInput.launcherWhenOpen === 'same'
        ? chatUIInput.launcherWhenOpen
        : 'chevron-down',
    chatOpenAnimation:
      chatUIInput.chatOpenAnimation === 'fade'
        ? 'fade'
        : chatUIInput.chatOpenAnimation === 'expand' || chatUIInput.chatOpenAnimation === 'scale'
          ? 'expand'
          : 'slide-up-fade',
    openChatOnLoad: chatUIInput.openChatOnLoad !== false,
    showBranding: chatUIInput.showBranding !== false,
    brandingMessage: clampStr(
      typeof chatUIInput.brandingMessage === 'string' ? chatUIInput.brandingMessage.trim() : '',
      BOT_FIELD_MAX.brandingMessage,
    ),
    showPrivacyText: chatUIInput.showPrivacyText !== false,
    privacyText: clampStr(
      typeof chatUIInput.privacyText === 'string' ? chatUIInput.privacyText.trim() : '',
      BOT_FIELD_MAX.privacyText,
    ),
    liveIndicatorStyle: chatUIInput.liveIndicatorStyle === 'dot-only' ? 'dot-only' : 'label',
    statusIndicator: chatUIInput.statusIndicator === 'live' || chatUIInput.statusIndicator === 'active' ? chatUIInput.statusIndicator as BotChatUI['statusIndicator'] : 'none',
    statusDotStyle: chatUIInput.statusDotStyle === 'static' ? 'static' : 'blinking',
    showScrollToBottom: chatUIInput.showScrollToBottom !== false,
    showScrollToBottomLabel: chatUIInput.showScrollToBottomLabel !== false,
    scrollToBottomLabel: clampStr(
      typeof chatUIInput.scrollToBottomLabel === 'string' ? chatUIInput.scrollToBottomLabel.trim() : '',
      BOT_FIELD_MAX.scrollToBottomLabel,
    ),
    showScrollbar: chatUIInput.showScrollbar !== false,
    scrollChromeStyle: normalizeScrollChromeStyleInput(chatUIInput),
    scrollToBottomChromeStyle: normalizeScrollToBottomChromeStyleInput(chatUIInput),
    composerAsSeparateBox: chatUIInput.composerAsSeparateBox !== false,
    composerBorderWidth:
      typeof chatUIInput.composerBorderWidth === 'number' &&
        chatUIInput.composerBorderWidth >= 0 &&
        chatUIInput.composerBorderWidth <= 6
        ? (() => {
          const w = Number(chatUIInput.composerBorderWidth);
          return w > 0 && w < 0.5 ? 0.5 : Math.max(0, Math.min(6, w));
        })()
        : (chatUIInput as { showComposerBorder?: boolean }).showComposerBorder === false
          ? 0
          : 1,
    composerBorderColor: chatUIInput.composerBorderColor === 'default' ? 'default' : 'primary',
    composerControlStyle: normalizeComposerControlStyleInput(chatUIInput),
    speechRecordingWaveStyle: normalizeSpeechRecordingWaveStyleInput(chatUIInput),
    showMenuExpand: chatUIInput.showMenuExpand !== false,
    showMenuQuickLinks: chatUIInput.showMenuQuickLinks !== false,
    menuQuickLinks: normalizeMenuQuickLinks(chatUIInput.menuQuickLinks),
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUIInput.showComposerWithSuggestedQuestions === true,
    showAvatarInHeader: chatUIInput.showAvatarInHeader !== false,
    senderName: clampStr(
      typeof chatUIInput.senderName === 'string' ? chatUIInput.senderName.trim() : '',
      BOT_FIELD_MAX.senderName,
    ),
    showSenderName: chatUIInput.showSenderName !== false,
    showTime: chatUIInput.showTime !== false,
    showCopyButton: chatUIInput.showCopyButton !== false,
    showMessageFeedback: chatUIInput.showMessageFeedback !== false,
    userTextBubbleStyle: normalizeUserBubbleStyleInput(chatUIInput.userTextBubbleStyle),
    userVoiceBubbleStyle: normalizeUserBubbleStyleInput(chatUIInput.userVoiceBubbleStyle),
    showSources: chatUIInput.showSources === true,
    timePosition: timePos,
    allowFileUpload: chatUIInput.allowFileUpload === true,
    showMic: chatUIInput.showMic === true,
    showVoice: Object.prototype.hasOwnProperty.call(chatUIInput, "showVoice")
      ? chatUIInput.showVoice === true
      : chatUIInput.showMic === true,
  };
}

export function normalizePersonalityInput(personalityInput: Record<string, unknown>): BotPersonality {
  const personality: BotPersonality = {};
  if (typeof personalityInput.name === 'string' && personalityInput.name.trim()) {
    personality.name = clampStr(personalityInput.name.trim(), BOT_FIELD_MAX.personalityName);
  }
  if (typeof personalityInput.description === 'string' && personalityInput.description.trim()) {
    personality.description = clampStr(personalityInput.description.trim(), BOT_FIELD_MAX.personalityDescription);
  }
  if (typeof personalityInput.systemPrompt === 'string' && personalityInput.systemPrompt.trim()) {
    personality.systemPrompt = clampStr(personalityInput.systemPrompt.trim(), BOT_FIELD_MAX.personalitySystemPrompt);
  }
  const presetVal = String(personalityInput.behaviorPreset ?? '').trim();
  if (BEHAVIOR_PRESETS.has(presetVal)) personality.behaviorPreset = presetVal;
  const toneStr = String(personalityInput.tone ?? '');
  if (
    [
      'friendly', 'warm', 'supportive', 'empathetic', 'professional', 'formal',
      'confident', 'authoritative', 'casual', 'conversational', 'playful', 'enthusiastic',
      'neutral', 'diplomatic', 'direct', 'patient', 'calm', 'technical',
    ].includes(toneStr)
  ) {
    personality.tone = personalityInput.tone as BotPersonality['tone'];
  }
  if (typeof personalityInput.language === 'string' && personalityInput.language.trim()) {
    personality.language = clampStr(personalityInput.language.trim(), BOT_FIELD_MAX.personalityLanguage);
  }
  if (typeof personalityInput.thingsToAvoid === 'string' && personalityInput.thingsToAvoid.trim()) {
    personality.thingsToAvoid = clampStr(personalityInput.thingsToAvoid.trim(), BOT_FIELD_MAX.thingsToAvoid);
  }
  return personality;
}

export function normalizeConfigInput(configInput: Record<string, unknown>): BotConfig {
  const configCandidate: BotConfig = {};
  if (typeof configInput.temperature === 'number' && configInput.temperature >= 0 && configInput.temperature <= 1) configCandidate.temperature = configInput.temperature;
  if (typeof configInput.maxTokens === 'number' && Number.isFinite(configInput.maxTokens)) configCandidate.maxTokens = Math.max(1, Math.floor(configInput.maxTokens));
  if (['short', 'medium', 'long'].includes(String(configInput.responseLength))) configCandidate.responseLength = configInput.responseLength as BotConfig['responseLength'];
  return configCandidate;
}

export interface NormalizedBotPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  avatarEmoji?: string;
  knowledgeDescription?: string;
  knowledgeSnippets?: Array<{ title: string; snippet: string; active: boolean }>;
  knowledgeDatasheets?: Array<{
    title: string;
    columns: string[];
    rows: string[][];
    active: boolean;
    importFileSize?: number;
    importFileName?: string;
  }>;
  faqs: NormalizedFaqV2[];
  exampleQuestions?: ExampleQuestionDoc[];
  welcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  personality?: BotPersonality;
  config?: BotConfig;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
  limitOverrideMessages?: number;
  visibility?: 'public' | 'private';
  isPublic: boolean;
  status?: 'draft' | 'published';
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge: boolean;
  /** Omitted from PATCH body = leave unchanged on server. */
  allowedOrigins?: AllowedOrigin[];
  /** Present only when `visitorMultiChatEnabled` is in the request body. */
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
}

export function normalizeBotPayload(input: Record<string, unknown>): NormalizedBotPayload {
  const allowedOrigins = normalizeAllowedOriginsFromPayload(input);
  const name = clampStr(String(input.name ?? '').trim(), BOT_FIELD_MAX.name);
  const shortDescription = clampStr(String(input.shortDescription ?? '').trim(), BOT_FIELD_MAX.shortDescription);
  const description = clampStr(String(input.description ?? '').trim(), BOT_FIELD_MAX.description);
  const categories = Array.isArray(input.categories)
    ? (input.categories as unknown[])
        .map((e) => clampStr(String(e).trim(), BOT_FIELD_MAX.categoryText))
        .filter(Boolean) as string[]
    : [];
  const imageUrl = String(input.imageUrl ?? '').trim();
  const avatarEmoji = String(input.avatarEmoji ?? '').trim();
  const knowledgeDescription = clampStr(
    String(input.knowledgeDescription ?? '').trim(),
    BOT_FIELD_MAX.knowledgeDescription,
  );
  const welcomeMessage = clampStr(String(input.welcomeMessage ?? '').trim(), BOT_FIELD_MAX.welcomeMessage);
  const welcomeMessageEnabled =
    typeof input.welcomeMessageEnabled === 'boolean' ? input.welcomeMessageEnabled : undefined;
  const openaiApiKeyOverride = String(input.openaiApiKeyOverride ?? '').trim();
  const whisperApiKeyOverride = String(input.whisperApiKeyOverride ?? '').trim();
  const limitOverrideMessages =
    typeof input.limitOverrideMessages === 'number' && Number.isFinite(input.limitOverrideMessages)
      ? Math.max(0, Math.floor(input.limitOverrideMessages))
      : undefined;
  const visibility =
    input.visibility === 'private' || input.visibility === 'public'
      ? input.visibility
      : undefined;
  const isPublic = input.isPublic !== false;
  const status = input.status === 'draft' || input.status === 'published' ? input.status : undefined;
  const includeNameInKnowledge = input.includeNameInKnowledge === true;
  const includeTaglineInKnowledge = input.includeTaglineInKnowledge === true;
  const includeNotesInKnowledge = input.includeNotesInKnowledge !== false;
  assertFaqsWithinPlanLimits(input.faqs);
  assertSnippetsWithinPlanLimits(input.knowledgeSnippets);
  assertSuggestionsWithinPlanLimits(input.exampleQuestions);
  const faqs = normalizeFaqs(input.faqs);
  const knowledgeSnippets = normalizeKnowledgeSnippets(input.knowledgeSnippets);
  const knowledgeDatasheets = normalizeKnowledgeDatasheets(
    (input as Record<string, unknown>).knowledgeDatasheets ?? (input as Record<string, unknown>).knowledgeTables,
  );
  const exampleQuestions = normalizeExampleQuestions(input.exampleQuestions);
  const leadCapture = normalizeLeadCapture(input.leadCapture);

  const chatUIInput = (input.chatUI ?? {}) as Record<string, unknown>;
  const chatUI = buildNormalizedChatUI(chatUIInput);

  const personalityInput = (input.personality ?? {}) as Record<string, unknown>;
  const personality = normalizePersonalityInput(personalityInput);
  const personalityOut = Object.keys(personality).length ? personality : undefined;

  const configInput = (input.config ?? {}) as Record<string, unknown>;
  const configCandidate = normalizeConfigInput(configInput);
  const config = Object.keys(configCandidate).length ? configCandidate : undefined;

  const visitorMultiPatch =
    'visitorMultiChatEnabled' in input
      ? (() => {
        const en = input.visitorMultiChatEnabled === true;
        const rawVisitorMax = input.visitorMultiChatMax;
        const max = !en ? null : normalizeVisitorMultiChatMax(rawVisitorMax);
        return { visitorMultiChatEnabled: en, visitorMultiChatMax: max } as const;
      })()
      : null;

  return {
    name,
    shortDescription: shortDescription || undefined,
    description: description || undefined,
    categories,
    imageUrl: imageUrl || undefined,
    avatarEmoji: avatarEmoji || undefined,
    knowledgeDescription: knowledgeDescription || undefined,
    ...(knowledgeSnippets.length > 0 ? { knowledgeSnippets } : {}),
    ...(knowledgeDatasheets.length > 0 ? { knowledgeDatasheets } : {}),
    faqs,
    exampleQuestions: exampleQuestions.length > 0 ? exampleQuestions : undefined,
    welcomeMessage: welcomeMessage || undefined,
    ...(welcomeMessageEnabled !== undefined ? { welcomeMessageEnabled } : {}),
    leadCapture,
    chatUI,
    personality: personalityOut,
    config,
    openaiApiKeyOverride: openaiApiKeyOverride || undefined,
    whisperApiKeyOverride: whisperApiKeyOverride || undefined,
    limitOverrideMessages,
    visibility,
    isPublic,
    status,
    includeNameInKnowledge,
    includeTaglineInKnowledge,
    includeNotesInKnowledge,
    ...(allowedOrigins !== undefined ? { allowedOrigins } : {}),
    ...(visitorMultiPatch ?? {}),
  };
}

/**
 * Sparse PATCH: only keys present in the request body are normalized and marked in `touched`.
 * Omitted keys must not be written by the service (preserves existing DB values).
 */
export type WorkspaceBotPatchNormalized = {
  touched: Set<string>;
  name?: string;
  shortDescription?: string;
  description?: string;
  categories?: string[];
  imageUrl?: string;
  avatarEmoji?: string;
  avatarSource?: 'upload' | 'url' | 'emoji' | 'none';
  knowledgeDescription?: string;
  knowledgeSnippets?: Array<{ title: string; snippet: string; active: boolean }>;
  knowledgeDatasheets?: Array<{
    title: string;
    columns: string[];
    rows: string[][];
    active: boolean;
    importFileSize?: number;
    importFileName?: string;
  }>;
  welcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
  faqs?: NormalizedFaqV2[];
  exampleQuestions?: ExampleQuestionDoc[];
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  personality?: BotPersonality;
  config?: BotConfig;
  translationSettings?: BotTranslationSettings;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
  limitOverrideMessages?: number;
  visibility?: 'public' | 'private';
  isPublic?: boolean;
  status?: 'draft' | 'published';
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  allowedOrigins?: AllowedOrigin[];
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
  knowledgeReplyPriority?: KnowledgeReplyPrioritySettings;
};

export function normalizeWorkspaceBotPatch(input: Record<string, unknown>): WorkspaceBotPatchNormalized {
  const touched = new Set<string>();
  for (const k of Object.keys(input)) {
    if (WORKSPACE_PATCH_RECOGNIZED_KEYS.has(k)) touched.add(k);
  }

  for (const bad of KB_CONTENT_KEYS_BLOCKED_ON_BOT_PATCH) {
    if (touched.has(bad)) {
      throw new HttpException(
        {
          error:
            'Knowledge content updates are not allowed on this endpoint. Use /knowledge routes: PATCH faqs/:index, snippets/:index, datasheets/:index, description; POST suggestions, POST suggestions/sync; or PATCH suggestions/:index/label or scope.',
          errorCode: 'bot_patch_kb_content_use_dedicated_route',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  const out: WorkspaceBotPatchNormalized = { touched };

  if (touched.has('name')) {
    out.name = clampStr(String(input.name ?? '').trim(), BOT_FIELD_MAX.name);
  }
  if (touched.has('shortDescription')) {
    const s = clampStr(String(input.shortDescription ?? '').trim(), BOT_FIELD_MAX.shortDescription);
    out.shortDescription = s || undefined;
  }
  if (touched.has('description')) {
    const s = clampStr(String(input.description ?? '').trim(), BOT_FIELD_MAX.description);
    out.description = s || undefined;
  }
  if (touched.has('categories')) {
    out.categories = Array.isArray(input.categories)
      ? (input.categories as unknown[])
          .map((e) => clampStr(String(e).trim(), BOT_FIELD_MAX.categoryText))
          .filter(Boolean) as string[]
      : [];
  }
  if (touched.has('imageUrl')) {
    const s = String(input.imageUrl ?? '').trim();
    out.imageUrl = s || undefined;
  }
  if (touched.has('avatarEmoji')) {
    const s = String(input.avatarEmoji ?? '').trim();
    out.avatarEmoji = s || undefined;
  }
  if (touched.has('avatarSource')) {
    const v = String(input.avatarSource ?? '').trim();
    if (v === 'upload' || v === 'url' || v === 'emoji' || v === 'none') {
      out.avatarSource = v;
    }
  }
  if (touched.has('welcomeMessage')) {
    const s = clampStr(String(input.welcomeMessage ?? '').trim(), BOT_FIELD_MAX.welcomeMessage);
    out.welcomeMessage = s || undefined;
  }
  if (touched.has('welcomeMessageEnabled')) {
    out.welcomeMessageEnabled =
      typeof input.welcomeMessageEnabled === 'boolean' ? input.welcomeMessageEnabled : false;
  }
  if (touched.has('leadCapture')) {
    out.leadCapture = normalizeLeadCapture(input.leadCapture);
  }
  if (touched.has('chatUI')) {
    const raw = input.chatUI;
    const chatUIInput = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    out.chatUI = buildNormalizedChatUI(chatUIInput);
  }
  if (touched.has('personality') && input.personality && typeof input.personality === 'object') {
    out.personality = normalizePersonalityInput(input.personality as Record<string, unknown>);
  }
  if (touched.has('config') && input.config && typeof input.config === 'object') {
    out.config = normalizeConfigInput(input.config as Record<string, unknown>);
  }
  if (touched.has('translationSettings')) {
    out.translationSettings = normalizeTranslationSettings(input.translationSettings);
  }
  if (touched.has('openaiApiKeyOverride')) {
    const s = String(input.openaiApiKeyOverride ?? '').trim();
    out.openaiApiKeyOverride = s || undefined;
  }
  if (touched.has('whisperApiKeyOverride')) {
    const s = String(input.whisperApiKeyOverride ?? '').trim();
    out.whisperApiKeyOverride = s || undefined;
  }
  if (touched.has('limitOverrideMessages')) {
    out.limitOverrideMessages =
      typeof input.limitOverrideMessages === 'number' && Number.isFinite(input.limitOverrideMessages)
        ? Math.max(0, Math.floor(input.limitOverrideMessages))
        : undefined;
  }
  if (touched.has('visibility')) {
    out.visibility =
      input.visibility === 'private' || input.visibility === 'public' ? input.visibility : undefined;
  }
  if (touched.has('isPublic')) {
    out.isPublic = input.isPublic !== false;
  }
  if (touched.has('status')) {
    out.status = input.status === 'draft' || input.status === 'published' ? input.status : undefined;
  }
  if (touched.has('includeNameInKnowledge')) {
    out.includeNameInKnowledge = input.includeNameInKnowledge === true;
  }
  if (touched.has('includeTaglineInKnowledge')) {
    out.includeTaglineInKnowledge = input.includeTaglineInKnowledge === true;
  }
  if (touched.has('includeNotesInKnowledge')) {
    out.includeNotesInKnowledge = input.includeNotesInKnowledge !== false;
  }
  if (touched.has('allowedOrigins')) {
    out.allowedOrigins = normalizeAllowedOriginsFromPayload(input) ?? [];
  }
  if (touched.has('visitorMultiChatEnabled')) {
    const en = input.visitorMultiChatEnabled === true;
    out.visitorMultiChatEnabled = en;
    out.visitorMultiChatMax = !en ? null : normalizeVisitorMultiChatMax(input.visitorMultiChatMax);
  }
  if (touched.has('knowledgeReplyPriority')) {
    out.knowledgeReplyPriority = normalizeKnowledgeReplyPrioritySettings(input.knowledgeReplyPriority);
  }

  return out;
}
