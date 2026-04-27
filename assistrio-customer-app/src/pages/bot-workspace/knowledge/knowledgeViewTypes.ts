import type { CustomerBotDetail, CustomerKnowledgeItemTrainingStatus } from '../../../api/types';

export type KbItemTrainingStatus = CustomerKnowledgeItemTrainingStatus;

export type QaRow = {
  title: string;
  questions: string[];
  answer: string;
  active?: boolean;
  trainingStatus?: KbItemTrainingStatus;
  lastTrainedAt?: string | null;
};
export type SnippetRow = {
  title: string;
  snippet: string;
  active?: boolean;
  trainingStatus?: KbItemTrainingStatus;
  lastTrainedAt?: string | null;
};

const KB_TRAINING_STATUSES = new Set<string>(['queued', 'processing', 'ready', 'failed']);

export function pickKbItemTrainingStatus(raw: unknown): KbItemTrainingStatus | null {
  const s = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (KB_TRAINING_STATUSES.has(s)) return s as KbItemTrainingStatus;
  return null;
}

/** User-facing label for knowledge base item `status` (snippets/FAQs). */
export function kbItemTrainingStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'queued') return 'Queued';
  if (s === 'processing') return 'Training';
  if (s === 'ready') return 'Trained';
  if (s === 'failed') return 'Failed';
  if (!s) return '—';
  return status ?? '—';
}

export function kbItemTrainingStatusDotClassName(status: string | null | undefined): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'ready') return 'bg-emerald-500';
  if (s === 'failed') return 'bg-red-500';
  if (s === 'processing') return 'bg-amber-500';
  if (s === 'queued') return 'bg-slate-400';
  return 'bg-slate-300';
}

/** Relative time from an ISO timestamp (e.g. “3 days ago”) for last trained. */
export function formatKbItemLastTrainedRelative(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || !iso.trim()) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** Human-readable byte size for datasheet import / KB metadata. */
export function formatKbFileSizeDisplay(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${Math.round(mb * 10) / 10} MB`;
}

/** Locale date + time for “last trained”. */
export function formatKbItemLastTrainedDateTime(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || !iso.trim()) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}
export type TableBlock = {
  title: string;
  columns: string[];
  rows: string[][];
  active?: boolean;
  trainingStatus?: KbItemTrainingStatus;
  lastTrainedAt?: string | null;
  importFileSize?: number | null;
  importFileName?: string | null;
};

/** Drop columns by original indices (0-based). Requires at least one column left. */
export function tableBlockWithColumnsRemoved(t: TableBlock, removeIndices: Set<number>): TableBlock {
  const keep = t.columns.map((_, i) => i).filter((i) => !removeIndices.has(i));
  if (keep.length === 0) {
    return { ...t, columns: [], rows: t.rows.map(() => []) };
  }
  const columns = keep.map((i) => t.columns[i] ?? '');
  const rows = t.rows.map((r) => keep.map((i) => String(r[i] ?? '')));
  return { ...t, columns, rows };
}

export function datasheetsFromBot(bot: CustomerBotDetail | null): TableBlock[] {
  if (!bot) return [];
  const b = bot as CustomerBotDetail & { knowledgeDatasheets?: TableBlock[]; knowledgeTables?: TableBlock[] };
  const raw = Array.isArray(b.knowledgeDatasheets)
    ? b.knowledgeDatasheets
    : Array.isArray(b.knowledgeTables)
      ? b.knowledgeTables
      : [];
  return raw
    .filter((t) => t.active !== false)
    .map((t) => {
      const ext = t as {
        trainingStatus?: unknown;
        lastTrainedAt?: string | null;
        importFileSize?: unknown;
        importFileName?: unknown;
      };
      const st = pickKbItemTrainingStatus(ext.trainingStatus);
      const importFileSize =
        typeof ext.importFileSize === 'number' && Number.isFinite(ext.importFileSize)
          ? ext.importFileSize
          : ext.importFileSize === null
            ? null
            : undefined;
      const importFileName =
        typeof ext.importFileName === 'string' && ext.importFileName.trim()
          ? ext.importFileName.trim()
          : ext.importFileName === null
            ? null
            : undefined;
      return {
        title: (t.title ?? '').trim() || 'Datasheet',
        columns: Array.isArray(t.columns) ? t.columns.map((c) => String(c ?? '')) : [],
        rows: Array.isArray(t.rows) ? t.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [],
        active: true,
        ...(st ? { trainingStatus: st } : {}),
        lastTrainedAt: typeof ext.lastTrainedAt === 'string' ? ext.lastTrainedAt : null,
        ...(importFileSize !== undefined ? { importFileSize } : {}),
        ...(importFileName !== undefined ? { importFileName } : {}),
      };
    })
    .filter((t) => t.columns.length > 0 && t.rows.length > 0);
}

export function snippetsFromBot(bot: CustomerBotDetail | null): SnippetRow[] {
  if (!bot) return [];
  const b = bot as CustomerBotDetail & { knowledgeSnippets?: SnippetRow[] };
  if (Array.isArray(b.knowledgeSnippets) && b.knowledgeSnippets.length > 0) {
    return b.knowledgeSnippets
      .filter((s) => s.active !== false)
      .map((s) => {
        const ext = s as { trainingStatus?: unknown; lastTrainedAt?: string | null };
        const st = pickKbItemTrainingStatus(ext.trainingStatus);
        const row: SnippetRow = {
          title: (s.title ?? '').trim() || 'Snippet',
          snippet: String(s.snippet ?? '').trim(),
          active: true,
        };
        if (st != null) row.trainingStatus = st;
        if ('lastTrainedAt' in ext) {
          const lt = ext.lastTrainedAt;
          row.lastTrainedAt = typeof lt === 'string' && lt.trim() ? lt : lt === null ? null : null;
        }
        return row;
      })
      .filter((s) => s.snippet);
  }
  const legacy = String(bot.knowledgeDescription ?? '').trim();
  return legacy ? [{ title: 'Notes', snippet: legacy, active: true }] : [];
}

export function normalizeQaFromApi(raw: unknown): QaRow {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const answer = String(o.answer ?? '').trim();
  const qLegacy = String(o.question ?? '').trim();
  const title = String(o.title ?? '').trim();
  const qs = Array.isArray(o.questions)
    ? (o.questions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean)
    : [];
  const questions = qs.length > 0 ? qs : qLegacy ? [qLegacy] : title ? [title] : [];
  const st = pickKbItemTrainingStatus(o.trainingStatus);
  const row: QaRow = { title, questions, answer, active: o.active === false ? false : true };
  if (st != null) row.trainingStatus = st;
  if ('lastTrainedAt' in o) {
    const lt = o.lastTrainedAt;
    row.lastTrainedAt = typeof lt === 'string' && lt.trim() ? lt : null;
  }
  return row;
}

export function faqsFromBot(bot: CustomerBotDetail | null): QaRow[] {
  if (!bot || !Array.isArray(bot.faqs)) return [];
  return bot.faqs
    .map((f) => normalizeQaFromApi(f))
    .filter((f) => f.active !== false)
    .filter((f) => f.answer && (f.questions.length > 0 || f.title));
}

/** Shapes for PATCH `faqs` (backend workspace bot payload). */
export function faqsToPatchPayload(faqs: QaRow[]) {
  return faqs
    .map((f) => {
      const questions = f.questions.map((q) => q.trim()).filter(Boolean);
      const title = f.title.trim();
      const qList = questions.length > 0 ? questions : title ? [title] : [];
      return {
        title: title || undefined,
        questions: qList,
        question: qList[0] ?? 'Question',
        answer: f.answer.trim(),
        active: f.active !== false,
      };
    })
    .filter((f) => f.answer && f.questions.length > 0);
}

export function previewText(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

export const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';
