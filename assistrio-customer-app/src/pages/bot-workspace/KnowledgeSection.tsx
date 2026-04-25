import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react';
import { useLocation } from 'react-router-dom';
import { appToast } from '@/lib/app-toast';
import { FileIcon, defaultStyles } from 'react-file-icon';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  deleteCustomerBotDocument,
  getCustomerBotDocuments,
  patchCustomerBot,
  patchCustomerBotDocument,
  postCustomerBotDocumentRequeue,
  postCustomerBotDocumentUpload,
  postCustomerBotDocumentsBulkDelete,
} from '../../api/customerApi';
import type { CustomerWorkspaceDocument } from '../../api/types';
import { useBotWorkspace } from './BotWorkspaceContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { cn } from '@/lib/utils';
import { ws as styles } from './workspace';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  FieldRow,
  FilterCapsule,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
} from '@/components/ui';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

const SECTION_NAV_LABEL = 'Knowledge Base';
const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

function docId(row: CustomerWorkspaceDocument): string {
  const id = row._id;
  if (id && typeof id === 'object' && id !== null && 'toString' in id) {
    return String((id as { toString(): string }).toString());
  }
  return String(id ?? '');
}

const CLIENT_PENDING_DOC_PREFIX = 'pending-upload:';

function isClientPendingDocumentId(id: string): boolean {
  return id.startsWith(CLIENT_PENDING_DOC_PREFIX);
}

function newClientPendingDocumentId(): string {
  const c = globalThis.crypto?.randomUUID?.();
  return `${CLIENT_PENDING_DOC_PREFIX}${c ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

type FaqRow = { question: string; answer: string; active?: boolean };
type KnowledgeTabId = 'documents' | 'faqs' | 'notes';
type FaqEditModalState = { mode: 'create' | 'edit'; index: number; question: string; answer: string } | null;

function previewText(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function formatFileSize(bytes: unknown): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

/** Relative time from an ISO timestamp (e.g. “3 days ago”). */
function formatRelativeAdded(iso: unknown): string {
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

/** When ingest finished successfully (`ready`), ISO time of last training; otherwise null. */
function documentLastTrainedIso(row: Record<string, unknown>): string | null {
  const st = String(row.status ?? '').toLowerCase();
  if (st !== 'ready') return null;
  const raw = row.ingestedAt;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (raw && typeof raw === 'object' && raw !== null && 'toISOString' in raw) {
    try {
      return (raw as Date).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function documentLastTrainedMs(row: Record<string, unknown>): number | null {
  const iso = documentLastTrainedIso(row);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function formatLastTrainedCell(row: Record<string, unknown>): string {
  const iso = documentLastTrainedIso(row);
  if (!iso) return 'Never';
  return formatRelativeAdded(iso);
}

function startOfDayMs(yyyyMmDd: string): number | null {
  const t = yyyyMmDd.trim();
  if (!t) return null;
  const d = new Date(`${t}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function endOfDayMs(yyyyMmDd: string): number | null {
  const t = yyyyMmDd.trim();
  if (!t) return null;
  const d = new Date(`${t}T23:59:59.999`);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function formatShortDateFromYyyyMmDd(yyyyMmDd: string): string {
  const t = yyyyMmDd.trim();
  if (!t) return '';
  const d = new Date(`${t}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return t;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type DocStatusFilter = 'all' | 'queued' | 'processing' | 'ready' | 'failed';

/** User-facing label for API pipeline status (`queued`, `processing`, …). */
function trainingPipelineStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'uploading') return 'Uploading';
  if (s === 'queued') return 'Queued';
  if (s === 'processing') return 'Training';
  if (s === 'ready') return 'Trained';
  if (s === 'failed') return 'Failed';
  return status;
}

const DOC_STATUS_FILTERS: { id: DocStatusFilter; label: string }[] = [
  { id: 'queued', label: 'Queued' },
  { id: 'processing', label: 'Training' },
  { id: 'ready', label: 'Trained' },
  { id: 'failed', label: 'Failed' },
];

type DocActiveFilter = 'all' | 'active' | 'inactive';

const DOC_ACTIVE_FILTERS: { id: DocActiveFilter; label: string }[] = [
  { id: 'active', label: 'Yes' },
  { id: 'inactive', label: 'No' },
];

type OpenDocFilter = null | 'indexing' | 'active' | 'lastTrained';

function fileTypeLabel(fileName: unknown, fileType: unknown): string {
  const ft = String(fileType ?? '').trim();
  if (ft && ft !== 'unknown') return ft.toUpperCase();
  const n = String(fileName ?? '');
  const ext = n.includes('.') ? n.split('.').pop() : '';
  return (ext || 'FILE').toUpperCase();
}

/** Extension from file name, or a short type token from API when it is not a MIME string. */
function fileExtensionHint(fileName: unknown, fileType: unknown): string {
  const name = String(fileName ?? '');
  const base = name.split(/[/\\]/).pop() ?? '';
  if (base.includes('.')) {
    return base.split('.').pop()!.toLowerCase();
  }
  const raw = String(fileType ?? '').trim().toLowerCase();
  if (!raw || raw === 'unknown') return '';
  if (raw.includes('/')) return '';
  const token = raw.replace(/^\./, '');
  if (token.length <= 12 && /^[a-z0-9]+$/i.test(token)) return token;
  return '';
}

type FileIconStyleKey = keyof typeof defaultStyles;

/** Map MIME type to a key that exists in `react-file-icon` defaultStyles. */
function fileIconStyleKeyFromMime(mime: string): FileIconStyleKey | null {
  const m = mime.toLowerCase();
  if (!m.includes('/')) return null;
  if (m.includes('pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'png';
  if (m.startsWith('video/')) return 'mp4';
  if (m.startsWith('audio/')) return 'mp3';
  if (m.includes('wordprocessing') || m === 'application/msword') return 'docx';
  if (m.includes('spreadsheet') || m.includes('excel')) return 'xlsx';
  if (m === 'text/csv') return 'csv';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'pptx';
  if (m === 'application/json' || m.endsWith('+json')) return 'json';
  if (m === 'application/javascript' || m === 'text/javascript' || m.includes('javascript')) return 'js';
  if (m === 'text/html') return 'html';
  if (m === 'text/css') return 'css';
  if (m === 'application/xml' || m === 'text/xml') return 'html';
  if (m.startsWith('text/')) return 'txt';
  if (
    m === 'application/zip' ||
    m === 'application/x-zip-compressed' ||
    m.includes('compressed') ||
    m.includes('archive')
  ) {
    return 'zip';
  }
  return null;
}

const FILE_ICON_EXT_ALIASES: Partial<Record<string, FileIconStyleKey>> = {
  tsx: 'ts',
  cjs: 'js',
  mjs: 'js',
  mts: 'ts',
  cts: 'ts',
  vue: 'js',
  svelte: 'js',
  mdx: 'md',
  markdown: 'md',
  jpeg: 'jpg',
  pyw: 'py',
};

function resolveFileIconStyleKey(fileName: unknown, fileType: unknown): FileIconStyleKey {
  const ext = fileExtensionHint(fileName, fileType);
  const mime = String(fileType ?? '').trim().toLowerCase();

  if (ext) {
    if (ext in defaultStyles) return ext as FileIconStyleKey;
    const aliased = FILE_ICON_EXT_ALIASES[ext];
    if (aliased) return aliased;
  }

  const fromMime = fileIconStyleKeyFromMime(mime);
  if (fromMime) return fromMime;

  if (ext) {
    if (/^(gz|bz2|tgz|7z|tar)$/.test(ext)) return 'zip';
    if (/^(webm|avi|wmv)$/.test(ext)) return 'mp4';
    if (/^(flac|ogg|m4a)$/.test(ext)) return 'mp3';
    if (/^(yaml)$/.test(ext)) return 'yml';
  }

  return 'txt';
}

/** Short label on the file icon (extension or inferred type). */
function fileIconExtensionLabel(fileName: unknown, fileType: unknown): string {
  const ext = fileExtensionHint(fileName, fileType);
  if (ext) {
    const u = ext.toUpperCase();
    return u.length <= 4 ? u : u.slice(0, 4);
  }
  const m = String(fileType ?? '').toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.startsWith('image/')) return 'IMG';
  if (m.startsWith('video/')) return 'VID';
  if (m.startsWith('audio/')) return 'AUD';
  if (m.includes('json')) return 'JSON';
  return 'FILE';
}

function fileDocumentFileIconProps(
  fileName: unknown,
  fileType: unknown,
): ComponentProps<typeof FileIcon> {
  const key = resolveFileIconStyleKey(fileName, fileType);
  return {
    ...(defaultStyles[key] as ComponentProps<typeof FileIcon>),
    extension: fileIconExtensionLabel(fileName, fileType),
  };
}

export function KnowledgeBaseSection() {
  const { pathname } = useLocation();
  const { bot, botId, softReload: softReloadBot } = useBotWorkspace();
  const [rows, setRows] = useState<CustomerWorkspaceDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [docCounts, setDocCounts] = useState<{
    total: number;
    queued: number;
    processing: number;
    ready: number;
    failed: number;
  } | null>(null);
  const [docPage, setDocPage] = useState(1);
  const [docPerPage, setDocPerPage] = useState(10);
  const [docStatusFilter, setDocStatusFilter] = useState<DocStatusFilter>('all');
  const [docActiveFilter, setDocActiveFilter] = useState<DocActiveFilter>('all');
  const [openDocFilter, setOpenDocFilter] = useState<OpenDocFilter>(null);
  const [indexingOptionQuery, setIndexingOptionQuery] = useState('');
  const [activeOptionQuery, setActiveOptionQuery] = useState('');
  const [docLastTrainedFrom, setDocLastTrainedFrom] = useState('');
  const [docLastTrainedTo, setDocLastTrainedTo] = useState('');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docDragOver, setDocDragOver] = useState(false);
  const [requeueLoadingId, setRequeueLoadingId] = useState<string | null>(null);
  const [patchActiveLoadingId, setPatchActiveLoadingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const tableSelectAllRef = useRef<HTMLInputElement | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [notesDirty, setNotesDirty] = useState(false);
  const notesDirtyRef = useRef(false);
  notesDirtyRef.current = notesDirty;
  const [notesSaving, setNotesSaving] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);
  type PersistFaqsResult = { ok: true } | { ok: false; error: string };
  const faqPersistTail = useRef<Promise<PersistFaqsResult>>(Promise.resolve({ ok: true }));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [snippet, setSnippet] = useState('');
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const faqsRef = useRef<FaqRow[]>([]);
  faqsRef.current = faqs;
  const [faqModal, setFaqModal] = useState<FaqEditModalState>(null);
  const [faqModalAttempted, setFaqModalAttempted] = useState(false);
  const [faqQuery, setFaqQuery] = useState('');
  const [faqDeleteIndex, setFaqDeleteIndex] = useState<number | null>(null);
  const [docDeleteTarget, setDocDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [docDeleteLoading, setDocDeleteLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Client-only placeholder rows while multipart upload is in flight (survive background list refresh). */
  const pendingDocUploadIdsRef = useRef<Set<string>>(new Set());
  const faqQuestionInputRef = useRef<HTMLInputElement | null>(null);
  const faqFormId = useId();

  function closeDocDeleteModal() {
    setDocDeleteTarget(null);
    setDocDeleteLoading(false);
  }

  const activeTab = useMemo<KnowledgeTabId>(() => {
    const p = pathname.replace(/\/$/, '');
    if (
      p.endsWith('/playground/knowledgebase/documents') ||
      p.endsWith('/knowledge/documents') ||
      p.endsWith('/knowledge/files')
    ) {
      return 'documents';
    }
    if (p.endsWith('/playground/knowledgebase/faqs') || p.endsWith('/knowledge/faqs') || p.endsWith('/knowledge/qa')) {
      return 'faqs';
    }
    return 'notes';
  }, [pathname]);

  const knowledgePageMeta = useMemo(() => {
    switch (activeTab) {
      case 'documents':
        return {
          pageTitle: 'Documents',
          pageLead:
            'Upload files, see when each one is indexed and ready, and choose which files the assistant may use in replies.',
        };
      case 'faqs':
        return {
          pageTitle: 'Questions & answers',
          pageLead: 'Short Q&A pairs stored on your assistant. Each change saves immediately.',
        };
      default:
        return {
          pageTitle: 'Notes',
          pageLead: 'Freeform context alongside documents and Q&A.',
        };
    }
  }, [activeTab]);

  const closeDocFilterMenu = useCallback(() => setOpenDocFilter(null), []);

  const loadDocs = useCallback(async (opts?: { background?: boolean }) => {
    if (!botId) return;
    const wid = botId;
    const bg = opts?.background === true;
    if (!bg) setDocLoading(true);
    setDocErr(null);
    const res = await getCustomerBotDocuments(wid, { page: 1, limit: 100 });
    setDocLoading(false);
    if (!res.ok) {
      setDocErr(res.error);
      setRows([]);
      setDocCounts(null);
      return;
    }
    const serverDocs = res.data.documents ?? [];
    setRows((prev) => {
      const pending = prev.filter(
        (r) => isClientPendingDocumentId(docId(r)) && pendingDocUploadIdsRef.current.has(docId(r)),
      );
      const serverIds = new Set(serverDocs.map((d) => docId(d as CustomerWorkspaceDocument)));
      const pendingOnly = pending.filter((p) => !serverIds.has(docId(p)));
      return [...pendingOnly, ...serverDocs];
    });
    const extraPending = pendingDocUploadIdsRef.current.size;
    const baseTotal = Number(res.data.total ?? 0) || 0;
    setTotal(baseTotal + extraPending);
    const c = res.data.counts as Record<string, unknown> | undefined;
    if (c && typeof c === 'object') {
      setDocCounts({
        total: (Number(c.total ?? 0) || 0) + extraPending,
        queued: Number(c.queued ?? 0) || 0,
        processing: Number(c.processing ?? 0) || 0,
        ready: Number(c.ready ?? 0) || 0,
        failed: Number(c.failed ?? 0) || 0,
      });
    } else {
      setDocCounts(null);
    }
  }, [botId]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const hasPendingIngestion = rows.some((r) => {
    const s = String(r.status ?? '').toLowerCase();
    return s === 'queued' || s === 'processing';
  });

  useEffect(() => {
    if (!botId || !hasPendingIngestion || uploading) return;
    const t = window.setInterval(() => void loadDocs({ background: true }), 4000);
    return () => window.clearInterval(t);
  }, [botId, hasPendingIngestion, uploading, loadDocs]);

  useEffect(() => {
    if (!bot) return;
    const raw = Array.isArray(bot.faqs) ? bot.faqs : [];
    const fr: FaqRow[] = raw
      .filter((f) => f.active !== false)
      .map((f) => ({
        question: String(f.question ?? ''),
        answer: String(f.answer ?? ''),
        active: true,
      }))
      .filter((f) => f.question && f.answer);
    setFaqs(fr);
    if (!notesDirtyRef.current) {
      setSnippet(String(bot.knowledgeDescription ?? ''));
      setNotesDirty(false);
    }
    setSaveError(null);
  }, [bot]);

  const faqHeaderDescription = useMemo(() => {
    if (faqs.length === 0) {
      return 'Pair common visitor questions with concise answers. Both fields are required for each pair.';
    }
    return `${faqs.length} question${faqs.length === 1 ? '' : 's'} · Each change saves immediately.`;
  }, [faqs.length]);

  const faqEntries = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    return faqs
      .map((faq, index) => ({ faq, index }))
      .filter(({ faq }) => {
        if (!q) return true;
        return (
          faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
        );
      });
  }, [faqs, faqQuery]);

  /** Counts by indexing step / pipeline status (full list — for filter). */
  const docStatusCounts = useMemo(() => {
    const c = { all: rows.length, queued: 0, processing: 0, ready: 0, failed: 0 };
    for (const r of rows) {
      const s = String(r.status ?? '').toLowerCase();
      if (s === 'queued') c.queued += 1;
      else if (s === 'processing') c.processing += 1;
      else if (s === 'ready') c.ready += 1;
      else if (s === 'failed') c.failed += 1;
    }
    return c;
  }, [rows]);

  /** Active = used in assistant replies; inactive = still in library but not used. */
  const docAnswerUsageCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const r of rows) {
      if (r.active !== false) active += 1;
      else inactive += 1;
    }
    return { active, inactive };
  }, [rows]);

  const docRowsAfterPipelineFilters = useMemo(() => {
    let list = rows;
    if (docStatusFilter !== 'all') {
      list = list.filter((r) => {
        const s = String(r.status ?? '').toLowerCase();
        if (docStatusFilter === 'queued') return s === 'queued' || s === 'uploading';
        return s === docStatusFilter;
      });
    }
    if (docActiveFilter === 'active') {
      list = list.filter((r) => r.active !== false);
    } else if (docActiveFilter === 'inactive') {
      list = list.filter((r) => r.active === false);
    }
    const fromMs = startOfDayMs(docLastTrainedFrom);
    const toMs = endOfDayMs(docLastTrainedTo);
    if (fromMs != null || toMs != null) {
      list = list.filter((r) => {
        const t = documentLastTrainedMs(r);
        if (t == null) return false;
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
        return true;
      });
    }
    return list;
  }, [rows, docStatusFilter, docActiveFilter, docLastTrainedFrom, docLastTrainedTo]);

  const docFilteredRows = useMemo(() => {
    let list = docRowsAfterPipelineFilters;
    const q = docSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const title = String(r.title ?? '').toLowerCase();
        const fileName = String(r.fileName ?? '').toLowerCase();
        const ft = String(r.fileType ?? '').toLowerCase();
        const st = String(r.status ?? '').toLowerCase();
        const stLabel = trainingPipelineStatusLabel(st).toLowerCase();
        const id = docId(r).toLowerCase();
        const usage = r.active !== false ? 'active' : 'inactive';
        const trainedLabel = formatLastTrainedCell(r).toLowerCase();
        return (
          title.includes(q) ||
          fileName.includes(q) ||
          ft.includes(q) ||
          st.includes(q) ||
          stLabel.includes(q) ||
          id.includes(q) ||
          usage.includes(q) ||
          trainedLabel.includes(q)
        );
      });
    }
    return list;
  }, [docRowsAfterPipelineFilters, docSearchQuery]);

  const docTotalPages = useMemo(
    () => Math.max(1, Math.ceil(docFilteredRows.length / docPerPage) || 1),
    [docFilteredRows.length, docPerPage],
  );

  const docPaginatedRows = useMemo(() => {
    const start = (docPage - 1) * docPerPage;
    return docFilteredRows.slice(start, start + docPerPage);
  }, [docFilteredRows, docPage, docPerPage]);

  const docListRange = useMemo(() => {
    const start = docFilteredRows.length === 0 ? 0 : (docPage - 1) * docPerPage + 1;
    const end = Math.min(docPage * docPerPage, docFilteredRows.length);
    return { start, end };
  }, [docFilteredRows.length, docPage, docPerPage]);

  const docAllOnPageSelected = useMemo(() => {
    const pageIds = docPaginatedRows
      .map((r) => docId(r))
      .filter((id) => id && !isClientPendingDocumentId(id));
    return pageIds.length > 0 && pageIds.every((id) => selectedDocIds.includes(id));
  }, [docPaginatedRows, selectedDocIds]);

  const docLastTrainedFilterApplied = docLastTrainedFrom.trim() !== '' || docLastTrainedTo.trim() !== '';

  const lastTrainedFilterValueLabel = useMemo(() => {
    const from = docLastTrainedFrom.trim();
    const to = docLastTrainedTo.trim();
    if (!from && !to) return '';
    const a = from ? formatShortDateFromYyyyMmDd(from) : '';
    const b = to ? formatShortDateFromYyyyMmDd(to) : '';
    if (a && b) return `${a} – ${b}`;
    if (a) return `${a} →`;
    return `→ ${b}`;
  }, [docLastTrainedFrom, docLastTrainedTo]);

  useEffect(() => {
    setDocPage(1);
  }, [docStatusFilter, docActiveFilter, docLastTrainedFrom, docLastTrainedTo, docSearchQuery]);

  useEffect(() => {
    if (openDocFilter === null) {
      setIndexingOptionQuery('');
      setActiveOptionQuery('');
    }
  }, [openDocFilter]);

  const indexingOptionsForDropdown = useMemo(() => {
    const q = indexingOptionQuery.trim().toLowerCase();
    return DOC_STATUS_FILTERS.filter(
      (f) => !q || f.label.toLowerCase().includes(q) || String(f.id).toLowerCase().includes(q),
    );
  }, [indexingOptionQuery]);

  const activeOptionsForDropdown = useMemo(() => {
    const q = activeOptionQuery.trim().toLowerCase();
    return DOC_ACTIVE_FILTERS.filter(
      (f) => !q || f.label.toLowerCase().includes(q) || String(f.id).toLowerCase().includes(q),
    );
  }, [activeOptionQuery]);

  useEffect(() => {
    setDocPage((p) => Math.min(Math.max(1, p), docTotalPages));
  }, [docTotalPages]);

  useEffect(() => {
    const el = tableSelectAllRef.current;
    if (!el) return;
    const pageIds = docPaginatedRows
      .map((r) => docId(r))
      .filter((id) => id && !isClientPendingDocumentId(id));
    const n = pageIds.filter((id) => selectedDocIds.includes(id)).length;
    el.indeterminate = n > 0 && n < pageIds.length;
  }, [docPaginatedRows, selectedDocIds]);

  async function removeDoc(documentIdToRemove: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!documentIdToRemove) return { ok: false, error: 'Missing document.' };
    if (isClientPendingDocumentId(documentIdToRemove)) {
      pendingDocUploadIdsRef.current.delete(documentIdToRemove);
      setRows((prev) => prev.filter((r) => docId(r) !== documentIdToRemove));
      setSelectedDocIds((prev) => prev.filter((id) => id !== documentIdToRemove));
      setTotal((t) => Math.max(0, t - 1));
      setDocCounts((c) =>
        c
          ? {
              ...c,
              total: Math.max(0, c.total - 1),
            }
          : c,
      );
      return { ok: true };
    }
    if (!botId) return { ok: false, error: 'Missing assistant.' };
    const res = await deleteCustomerBotDocument(botId, documentIdToRemove);
    if (!res.ok) {
      setDocErr(res.error);
      return { ok: false, error: res.error };
    }
    setRows((prev) => prev.filter((r) => docId(r) !== documentIdToRemove));
    setSelectedDocIds((prev) => prev.filter((id) => id !== documentIdToRemove));
    void loadDocs({ background: true });
    return { ok: true };
  }

  function bumpDocCountsForPendingUpload() {
    setTotal((t) => t + 1);
    setDocCounts((c) => ({
      total: (c?.total ?? 0) + 1,
      queued: c?.queued ?? 0,
      processing: c?.processing ?? 0,
      ready: c?.ready ?? 0,
      failed: c?.failed ?? 0,
    }));
  }

  function rollbackDocCountsForPendingUpload() {
    setTotal((t) => Math.max(0, t - 1));
    setDocCounts((c) =>
      c
        ? {
            ...c,
            total: Math.max(0, c.total - 1),
          }
        : c,
    );
  }

  const CUSTOMER_DOC_UPLOAD_MAX_PER_REQUEST = 5;

  async function uploadFilesFromPicker(files: File[]) {
    if (!botId) return;
    const list = files.filter((f) => f.size > 0);
    if (list.length === 0) return;
    setUploading(true);
    const n = list.length;
    appToast.info(n === 1 ? 'Upload started' : `Upload started · ${n} files`, {
      description:
        n === 1
          ? 'Your file is uploading. It will appear in the list with a status while it queues for processing.'
          : 'Your files are uploading in the background. Each one appears in the list with its own training status.',
    });
    const errors: string[] = [];
    let totalSuccess = 0;
    let lastTitle = '';
    try {
      for (let offset = 0; offset < list.length; offset += CUSTOMER_DOC_UPLOAD_MAX_PER_REQUEST) {
        const chunk = list.slice(offset, offset + CUSTOMER_DOC_UPLOAD_MAX_PER_REQUEST);
        const pendingMetas: { pendingId: string; file: File }[] = [];

        for (const file of chunk) {
          const pendingId = newClientPendingDocumentId();
          pendingDocUploadIdsRef.current.add(pendingId);
          pendingMetas.push({ pendingId, file });
          const pendingRow: CustomerWorkspaceDocument = {
            _id: pendingId,
            title: file.name,
            status: 'uploading',
            sourceType: 'upload',
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            active: true,
            createdAt: new Date().toISOString(),
          };
          setRows((prev) => [pendingRow, ...prev]);
          bumpDocCountsForPendingUpload();
        }

        const fd = new FormData();
        for (const file of chunk) {
          fd.append('file', file);
        }

        const rollbackChunkPendings = () => {
          for (const { pendingId } of pendingMetas) {
            pendingDocUploadIdsRef.current.delete(pendingId);
            setRows((prev) => prev.filter((r) => docId(r) !== pendingId));
            rollbackDocCountsForPendingUpload();
          }
        };

        let res: Awaited<ReturnType<typeof postCustomerBotDocumentUpload>>;
        try {
          res = await postCustomerBotDocumentUpload(botId, fd);
        } catch (e) {
          rollbackChunkPendings();
          errors.push(
            `${chunk.map((f) => f.name).join(', ')}: ${e instanceof Error ? e.message : 'Upload failed'}`,
          );
          continue;
        }
        if (!res.ok) {
          rollbackChunkPendings();
          errors.push(`${chunk.map((f) => f.name).join(', ')}: ${res.error}`);
          continue;
        }

        const docs = Array.isArray(res.data?.documents) ? res.data!.documents : [];
        if (docs.length !== chunk.length || docs.some((d) => !d || typeof d._id !== 'string' || !d._id)) {
          rollbackChunkPendings();
          errors.push(
            `${chunk.map((f) => f.name).join(', ')}: Invalid server response (expected ${chunk.length} documents)`,
          );
          continue;
        }

        for (const { pendingId } of pendingMetas) {
          pendingDocUploadIdsRef.current.delete(pendingId);
        }

        const realRows: CustomerWorkspaceDocument[] = docs.map((d) => ({
          _id: d._id,
          title: d.title,
          status: d.status,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          active: d.active,
          createdAt: d.createdAt,
        }));

        setRows((prev) => {
          const pendingIdSet = new Set(pendingMetas.map((m) => m.pendingId));
          const withoutPendings = prev.filter((r) => !pendingIdSet.has(docId(r)));
          const newIds = new Set(realRows.map((row) => docId(row)).filter(Boolean));
          const base = withoutPendings.filter((r) => !newIds.has(docId(r)));
          return [...realRows, ...base];
        });

        totalSuccess += docs.length;
        lastTitle = docs[docs.length - 1]?.title ?? lastTitle;
      }

      if (totalSuccess > 0 && errors.length === 0) {
        appToast.success(
          totalSuccess === 1 ? `“${lastTitle}” is queued` : `${totalSuccess} files queued`,
          {
            description:
              totalSuccess === 1
                ? 'Training will start shortly. Watch the Training status column for updates.'
                : 'Each file trains on its own. Watch the Training status column for updates.',
          },
        );
        void loadDocs({ background: true });
      } else if (totalSuccess > 0 && errors.length > 0) {
        const errPreview = errors.slice(0, 2).join(' ');
        const more = errors.length > 2 ? ` (+${errors.length - 2} more)` : '';
        appToast.error('Some files did not upload', {
          description: `${totalSuccess} file(s) are already queued. Still failing: ${errPreview}${more}. You can try again for the rest.`,
          primary: {
            label: 'Try again',
            onClick: () => fileInputRef.current?.click(),
          },
        });
        void loadDocs({ background: true });
      } else if (errors.length > 0) {
        const errPreview = errors.slice(0, 3).join(' ');
        const more = errors.length > 3 ? ` (+${errors.length - 3} more)` : '';
        appToast.error('Upload could not finish', {
          description: `${errPreview}${more} Use PDF, Word, text, or Markdown within size limits, then try again.`,
          primary: {
            label: 'Try again',
            onClick: () => fileInputRef.current?.click(),
          },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      appToast.error('Upload interrupted', {
        description: `${msg} Check your connection and try again when you are ready.`,
        primary: {
          label: 'Try again',
          onClick: () => fileInputRef.current?.click(),
        },
      });
    } finally {
      setUploading(false);
    }
  }

  async function onUploadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).filter((f) => f.size > 0);
    e.target.value = '';
    if (list.length === 0) return;
    await uploadFilesFromPicker(list);
  }

  async function toggleDocIncluded(documentId: string, active: boolean) {
    if (isClientPendingDocumentId(documentId)) return;
    if (!botId) return;
    setPatchActiveLoadingId(documentId);
    const res = await patchCustomerBotDocument(botId, documentId, { active });
    setPatchActiveLoadingId(null);
    if (!res.ok) {
      setDocErr(res.error);
      return;
    }
    void loadDocs({ background: true });
  }

  async function requeueDocument(documentId: string) {
    if (isClientPendingDocumentId(documentId)) return;
    if (!botId) return;
    setRequeueLoadingId(documentId);
    const res = await postCustomerBotDocumentRequeue(botId, documentId);
    setRequeueLoadingId(null);
    if (!res.ok) {
      setDocErr(res.error);
      return;
    }
    void loadDocs({ background: true });
  }

  async function bulkDeleteSelectedDocs() {
    if (!botId || selectedDocIds.length === 0) return;
    const serverIds = selectedDocIds.filter((id) => !isClientPendingDocumentId(id));
    if (serverIds.length === 0) {
      setSelectedDocIds([]);
      return;
    }
    setBulkDeleting(true);
    setDocErr(null);
    const res = await postCustomerBotDocumentsBulkDelete(botId, serverIds);
    setBulkDeleting(false);
    if (!res.ok) {
      setDocErr(res.error);
      appToast.error('Could not delete files', {
        description: `${res.error} Nothing was removed and your selection is unchanged.`,
        primary: {
          label: 'Retry',
          onClick: () => {
            void bulkDeleteSelectedDocs();
          },
        },
      });
      return;
    }
    const n = serverIds.length;
    appToast.success(n === 1 ? 'File removed' : `${n} files removed`, {
      description: 'They are no longer part of this assistant’s knowledge base.',
    });
    setSelectedDocIds([]);
    void loadDocs({ background: true });
  }

  function toggleDocRowSelected(documentId: string, selected: boolean) {
    setSelectedDocIds((prev) => {
      if (selected) return prev.includes(documentId) ? prev : [...prev, documentId];
      return prev.filter((x) => x !== documentId);
    });
  }

  function toggleSelectAllDocsOnPage(selected: boolean) {
    const pageIds = docPaginatedRows
      .map((r) => docId(r))
      .filter((id) => id && !isClientPendingDocumentId(id));
    setSelectedDocIds((prev) => {
      if (selected) {
        return Array.from(new Set([...prev, ...pageIds]));
      }
      return prev.filter((id) => !pageIds.includes(id));
    });
  }

  function markNotesDirty() {
    setNotesDirty(true);
    setSaveError(null);
  }

  async function persistFaqs(nextFaqs: FaqRow[]): Promise<PersistFaqsResult> {
    if (!botId) return { ok: false, error: 'Missing assistant.' };
    const cleaned = nextFaqs
      .map((f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
        active: f.active !== false,
      }))
      .filter((f) => f.question && f.answer);

    const run = (async (): Promise<PersistFaqsResult> => {
      setFaqSaving(true);
      setSaveError(null);
      try {
        const res = await patchCustomerBot(botId, { faqs: cleaned });
        if (!res.ok) {
          setSaveError(res.error);
          return { ok: false, error: res.error };
        }
        setFaqs(cleaned.map((f) => ({ question: f.question, answer: f.answer, active: f.active !== false })));
        void softReloadBot();
        return { ok: true };
      } finally {
        setFaqSaving(false);
      }
    })();

    const prev = faqPersistTail.current;
    const chained = prev.then(() => run);
    faqPersistTail.current = chained.catch(() => ({ ok: false, error: 'Could not save. Try again.' }));
    return chained;
  }

  async function onSaveKnowledge(e: FormEvent) {
    e.preventDefault();
    if (!bot || !botId) return;
    if (!notesDirty || notesSaving) return;
    setNotesSaving(true);
    setSaveError(null);
    const res = await patchCustomerBot(botId, { knowledgeDescription: snippet.trim() });
    setNotesSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setNotesDirty(false);
    void softReloadBot();
  }

  async function commitFaqModal() {
    if (!faqModal) return;
    setFaqModalAttempted(true);
    const question = faqModal.question.trim();
    const answer = faqModal.answer.trim();
    if (!question || !answer) return;
    const base = faqsRef.current;
    const next =
      faqModal.mode === 'create'
        ? [...base, { question, answer, active: true }]
        : base.map((item, idx) => (idx === faqModal.index ? { ...item, question, answer } : item));
    const r = await persistFaqs(next);
    if (!r.ok) {
      appToast.error('Could not save Q&A', { description: r.error });
      return;
    }
    const successHeadline = faqModal.mode === 'create' ? 'Q&A added' : 'Q&A updated';
    setFaqModal(null);
    setFaqModalAttempted(false);
    queueMicrotask(() =>
      appToast.success(successHeadline, {
        description: 'Saved to this assistant.',
      }),
    );
  }

  const discardNotes = useCallback(() => {
    if (!bot) return;
    setSnippet(String(bot.knowledgeDescription ?? ''));
    setNotesDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    return registerManualSaveGuard('knowledge-notes', () => notesDirty, discardNotes);
  }, [notesDirty, discardNotes]);

  const faqModalOpen = faqModal != null;
  const faqModalMode = faqModal?.mode ?? null;
  useEffect(() => {
    if (!faqModalOpen) return;
    setFaqModalAttempted(false);
    const t = window.setTimeout(() => {
      const el = faqQuestionInputRef.current;
      if (!el) return;
      el.focus();
      if (faqModalMode === 'create') el.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [faqModalOpen, faqModalMode]);

  if (!bot || !botId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-knowledge-base-editor>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        className="hidden"
        tabIndex={-1}
        onChange={(ev) => void onUploadFileChange(ev)}
      />
      <form className="flex min-h-0 w-full flex-1 flex-col" onSubmit={(e) => void onSaveKnowledge(e)}>
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={styles.workspaceEditorPageHeader}>
            <div className={styles.workspaceEditorTitleBlock}>
              <div className={styles.workspaceEditorHeadingStack}>
                <h1 className={styles.workspaceEditorH1}>{knowledgePageMeta.pageTitle}</h1>
                <p className={styles.workspaceEditorLead}>{knowledgePageMeta.pageLead}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:pt-0">
              {activeTab === 'documents' ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    styles.workspaceEditorButtonLabel,
                    'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                  )}
                  aria-busy={uploading || undefined}
                >
                  <Upload size={15} strokeWidth={2} aria-hidden />
                  {uploading ? 'Uploading' : 'Add files'}
                </Button>
              ) : activeTab === 'notes' ? (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!notesDirty || notesSaving}
                  className={cn(
                    styles.workspaceEditorButtonLabel,
                    'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                  )}
                  aria-busy={notesSaving || undefined}
                  aria-label={notesSaving ? 'Saving notes' : `Save ${SECTION_NAV_LABEL} notes`}
                >
                  {notesSaving ? (
                    <>
                      <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={15} strokeWidth={2} aria-hidden />
                      Save notes
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </header>

          {saveError ? (
            <div
              className={cn(
                styles.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
            >
              {saveError}
            </div>
          ) : null}

          {docErr ? (
            <div
              className={cn(
                styles.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
            >
              {docErr}
            </div>
          ) : null}

          <div
            className={styles.workspaceEditorCardGap}
            role="region"
            aria-label={knowledgePageMeta.pageTitle}
          >
            {activeTab === 'documents' ? (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Documents</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {(
                      [
                        { key: 'total', label: 'Total', value: docCounts?.total ?? total },
                        { key: 'queued', label: 'Queued', value: docCounts?.queued ?? 0 },
                        {
                          key: 'processing',
                          label: 'Training',
                          value: docCounts?.processing ?? 0,
                        },
                        { key: 'ready', label: 'Trained', value: docCounts?.ready ?? 0 },
                        { key: 'failed', label: 'Failed', value: docCounts?.failed ?? 0 },
                      ] as const
                    ).map((cell) => {
                      const processing =
                        cell.key === 'processing' && (docCounts?.processing ?? 0) > 0;
                      const ready = cell.key === 'ready' && (docCounts?.ready ?? 0) > 0;
                      const failed = cell.key === 'failed' && (docCounts?.failed ?? 0) > 0;
                      return (
                        <div
                          key={cell.key}
                          className={cn(
                            'flex min-h-[4.25rem] min-w-0 flex-col justify-center rounded-xl border px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                            cell.key === 'total' &&
                              'border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
                            cell.key === 'queued' && 'border-amber-200/80 bg-amber-50/70',
                            cell.key === 'processing' && 'border-blue-200/80 bg-blue-50/70',
                            cell.key === 'ready' && 'border-emerald-200/80 bg-emerald-50/70',
                            cell.key === 'failed' && 'border-red-200/80 bg-red-50/70',
                          )}
                        >
                          <p
                            className={cn(
                              'm-0 text-[0.65rem] font-semibold leading-snug tracking-wide',
                              cell.key === 'total' ? 'uppercase text-slate-900' : 'text-slate-800',
                            )}
                          >
                            {cell.label}
                          </p>
                          <p
                            className={cn(
                              'mt-1 tabular-nums leading-none text-slate-700',
                              cell.key === 'total' ? 'text-xl font-semibold' : 'text-lg font-medium',
                              docLoading && 'text-slate-400',
                              !docLoading && processing && 'text-blue-800/90',
                              !docLoading && ready && 'text-emerald-800/90',
                              !docLoading && failed && 'text-red-800/90',
                              !docLoading &&
                                !processing &&
                                !ready &&
                                !failed &&
                                cell.key !== 'total' &&
                                'text-slate-800',
                              !docLoading && cell.key === 'total' && 'text-slate-900',
                            )}
                          >
                            {docLoading ? '—' : cell.value}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDocDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDocDragOver(false);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDocDragOver(false);
                        const dropped = Array.from(e.dataTransfer.files ?? []).filter((f) => f.size > 0);
                        if (dropped.length > 0) void uploadFilesFromPicker(dropped);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors',
                        docDragOver
                          ? 'border-[var(--color-teal-600)] bg-[var(--teal-50)]/60'
                          : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80">
                        <Upload size={22} strokeWidth={1.75} className="text-teal-600" aria-hidden />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">Upload documents</p>
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                        .md · .txt · .pdf · .docx · .doc — Max 5 MB per file
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Drag and drop here, click to browse, or select several files (up to 5 per request; larger
                        selections are split automatically)—each batch queues right away.
                      </p>
                    </div>
                  </CardBody>
                </Card>

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-0 py-0 sm:px-0 sm:py-0">
                    <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <FilterCapsule
                            title="Training Status"
                            valueLabel={
                              docStatusFilter === 'all'
                                ? ''
                                : (DOC_STATUS_FILTERS.find((f) => f.id === docStatusFilter)?.label ?? '')
                            }
                            applied={docStatusFilter !== 'all'}
                            open={openDocFilter === 'indexing'}
                            onToggle={() =>
                              setOpenDocFilter((f) => (f === 'indexing' ? null : 'indexing'))
                            }
                            onClose={closeDocFilterMenu}
                            onClear={() => {
                              setDocStatusFilter('all');
                              closeDocFilterMenu();
                            }}
                          >
                            <Input
                              quiet
                              inputSize="sm"
                              value={indexingOptionQuery}
                              onChange={(e) => setIndexingOptionQuery(e.target.value)}
                              placeholder="Search options…"
                              leadingIcon={<Search size={14} strokeWidth={2} className="text-slate-400" aria-hidden />}
                              autoComplete="off"
                              aria-label="Search training status options"
                            />
                            <div className="my-2 border-t border-slate-200" role="separator" />
                            <ul className="max-h-52 space-y-0.5 overflow-y-auto py-0.5">
                              {indexingOptionsForDropdown.map((f) => {
                                const count = docStatusCounts[f.id as keyof typeof docStatusCounts];
                                const selected = docStatusFilter === f.id;
                                return (
                                  <li key={f.id}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                                      onClick={() => {
                                        setDocStatusFilter(f.id);
                                        setOpenDocFilter(null);
                                      }}
                                    >
                                      <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                                        {selected ? (
                                          <Check
                                            className="h-3.5 w-3.5 text-[var(--color-teal-600)]"
                                            strokeWidth={2.5}
                                          />
                                        ) : null}
                                      </span>
                                      <span className="min-w-0 flex-1">{f.label}</span>
                                      <span className="text-xs tabular-nums text-slate-400">{count}</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </FilterCapsule>

                          <FilterCapsule
                            title="Use in Replies"
                            valueLabel={
                              docActiveFilter === 'all'
                                ? ''
                                : (DOC_ACTIVE_FILTERS.find((f) => f.id === docActiveFilter)?.label ?? '')
                            }
                            applied={docActiveFilter !== 'all'}
                            open={openDocFilter === 'active'}
                            onToggle={() =>
                              setOpenDocFilter((f) => (f === 'active' ? null : 'active'))
                            }
                            onClose={closeDocFilterMenu}
                            onClear={() => {
                              setDocActiveFilter('all');
                              closeDocFilterMenu();
                            }}
                          >
                            <Input
                              quiet
                              inputSize="sm"
                              value={activeOptionQuery}
                              onChange={(e) => setActiveOptionQuery(e.target.value)}
                              placeholder="Search options…"
                              leadingIcon={<Search size={14} strokeWidth={2} className="text-slate-400" aria-hidden />}
                              autoComplete="off"
                              aria-label="Search use in replies options"
                            />
                            <div className="my-2 border-t border-slate-200" role="separator" />
                            <ul className="max-h-52 space-y-0.5 overflow-y-auto py-0.5">
                              {activeOptionsForDropdown.map((f) => {
                                const count =
                                  f.id === 'active'
                                    ? docAnswerUsageCounts.active
                                    : docAnswerUsageCounts.inactive;
                                const selected = docActiveFilter === f.id;
                                return (
                                  <li key={f.id}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                                      onClick={() => {
                                        setDocActiveFilter(f.id);
                                        setOpenDocFilter(null);
                                      }}
                                    >
                                      <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                                        {selected ? (
                                          <Check
                                            className="h-3.5 w-3.5 text-[var(--color-teal-600)]"
                                            strokeWidth={2.5}
                                          />
                                        ) : null}
                                      </span>
                                      <span className="min-w-0 flex-1">{f.label}</span>
                                      <span className="text-xs tabular-nums text-slate-400">{count}</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </FilterCapsule>

                          <FilterCapsule
                            title="Last trained"
                            valueLabel={lastTrainedFilterValueLabel}
                            applied={docLastTrainedFilterApplied}
                            open={openDocFilter === 'lastTrained'}
                            onToggle={() =>
                              setOpenDocFilter((f) => (f === 'lastTrained' ? null : 'lastTrained'))
                            }
                            onClose={closeDocFilterMenu}
                            onClear={() => {
                              setDocLastTrainedFrom('');
                              setDocLastTrainedTo('');
                              closeDocFilterMenu();
                            }}
                          >
                            <div className="flex flex-col gap-3">
                              <FieldRow label="From" htmlFor="kb-doc-trained-from">
                                <input
                                  id="kb-doc-trained-from"
                                  type="date"
                                  value={docLastTrainedFrom}
                                  onChange={(e) => setDocLastTrainedFrom(e.target.value)}
                                  className={cn(
                                    'h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800',
                                    'focus:border-[var(--color-teal-600)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-600)]/20',
                                  )}
                                  aria-label="Last trained from date"
                                />
                              </FieldRow>
                              <FieldRow label="To" htmlFor="kb-doc-trained-to">
                                <input
                                  id="kb-doc-trained-to"
                                  type="date"
                                  value={docLastTrainedTo}
                                  onChange={(e) => setDocLastTrainedTo(e.target.value)}
                                  className={cn(
                                    'h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800',
                                    'focus:border-[var(--color-teal-600)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-600)]/20',
                                  )}
                                  aria-label="Last trained to date"
                                />
                              </FieldRow>
                              <p className="m-0 text-[0.7rem] leading-snug text-slate-500">
                                Only documents that finished training at least once match a date range. Others show as
                                Never in the table.
                              </p>
                            </div>
                          </FilterCapsule>

                          {selectedDocIds.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 gap-1.5 text-[var(--color-danger-text-emphasis)]"
                              disabled={bulkDeleting}
                              onClick={() => void bulkDeleteSelectedDocs()}
                              aria-busy={bulkDeleting || undefined}
                            >
                              {bulkDeleting ? (
                                <>
                                  <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                                  Deleting…
                                </>
                              ) : (
                                `Delete (${selectedDocIds.length})`
                              )}
                            </Button>
                          ) : null}
                        </div>

                        <div className="w-full min-w-0 shrink-0 lg:w-80 lg:max-w-md">
                          <Input
                            id="knowledge-doc-search"
                            quiet
                            value={docSearchQuery}
                            onChange={(e) => setDocSearchQuery(e.target.value)}
                            placeholder="Search files by name, type, or status…"
                            leadingIcon={<Search size={16} strokeWidth={2} className="text-slate-400" aria-hidden />}
                            clearable
                            onClear={() => setDocSearchQuery('')}
                            autoComplete="off"
                            aria-label="Search documents"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto px-1 sm:px-2">
                      {docLoading ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-400">Loading documents…</p>
                      ) : rows.length === 0 ? (
                        <div className="px-3 py-4 sm:px-4 sm:py-5">
                          <div
                            role="status"
                            className={cn(
                              'flex flex-col items-center justify-center rounded-lg border border-slate-200/90',
                              'bg-slate-50/70 px-5 py-8 text-center sm:px-6 sm:py-9',
                              'ring-1 ring-slate-900/[0.02]',
                            )}
                          >
                            <div className="mx-auto max-w-md">
                              <p className="m-0 text-[0.9375rem] font-semibold tracking-[-0.02em] text-slate-900">
                                No documents yet
                              </p>
                              <p className="mb-0 mt-2.5 text-[0.8125rem] leading-[1.55] text-slate-500 text-pretty">
                                Add PDF, Word, plain text, or Markdown files. They are processed and become part of
                                this Agent&apos;s knowledge base.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <table className="w-full min-w-[46rem] table-fixed border-collapse text-left text-sm">
                          <colgroup>
                            <col className="w-10" />
                            <col />
                            <col className="w-[6.75rem] sm:w-28" />
                            <col className="w-[7.5rem] sm:w-[8.5rem]" />
                            <col className="w-[7rem] sm:w-32" />
                            <col className="w-[10.5rem] sm:w-44" />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                              <th className="w-10 px-2 py-2.5 sm:px-3">
                                <Checkbox
                                  ref={tableSelectAllRef}
                                  checked={docAllOnPageSelected}
                                  disabled={docFilteredRows.length === 0}
                                  onChange={(e) => toggleSelectAllDocsOnPage(e.target.checked)}
                                  aria-label="Select all on this page"
                                />
                              </th>
                              <th className="min-w-0 px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500 sm:px-3">
                                File
                              </th>
                              <th
                                className="px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase leading-snug tracking-wide text-slate-500 sm:px-3"
                                title="Queued, training, trained, or failed."
                              >
                                Training Status
                              </th>
                              <th
                                className="px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase leading-snug tracking-wide text-slate-500 sm:px-3"
                                title="Yes: the assistant can use this file in replies. No: it stays in your library but is not used in answers."
                              >
                                Use in Replies
                              </th>
                              <th
                                className="px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase leading-snug tracking-wide text-slate-500 sm:px-3"
                                title="When this file last finished training (embedding). Never if it is not ready yet."
                              >
                                Last trained
                              </th>
                              <th className="px-2 py-2.5 text-right text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500 sm:px-3">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {docFilteredRows.length === 0 ? (
                              <tr className="border-b border-slate-100">
                                <td
                                  colSpan={6}
                                  className="min-h-[14rem] bg-white px-4 py-14 align-middle sm:px-6"
                                >
                                  <div
                                    className={cn(
                                      styles.knowledgeEmpty,
                                      'mx-auto flex max-w-lg flex-col gap-3 border-slate-200/90 text-slate-600',
                                    )}
                                  >
                                    {docRowsAfterPipelineFilters.length === 0 ? (
                                      <>
                                        <p className="m-0">
                                          No documents match this filter combination. Adjust Training Status, Use in
                                          Replies, or Last trained above, or use Clear filters below.
                                        </p>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => {
                                            setDocStatusFilter('all');
                                            setDocActiveFilter('all');
                                            setDocLastTrainedFrom('');
                                            setDocLastTrainedTo('');
                                          }}
                                        >
                                          Clear filters
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <p className="m-0">
                                          {docSearchQuery.trim() ? (
                                            <>
                                              No files match &ldquo;{docSearchQuery.trim()}&rdquo;. Try different words
                                              or clear the search.
                                            </>
                                          ) : (
                                            <>No files match the current filters.</>
                                          )}
                                        </p>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => setDocSearchQuery('')}
                                        >
                                          Clear search
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              docPaginatedRows.map((row, index) => {
                              const documentId = docId(row);
                              const isPendingRow = isClientPendingDocumentId(documentId);
                              const fileLabel = String(row.title ?? row.fileName ?? 'Untitled');
                              const ftLabel = fileTypeLabel(row.fileName, row.fileType);
                              const status = String(row.status ?? 'unknown').toLowerCase();
                              const active = row.active !== false;
                              const size = formatFileSize(row.fileSize) ?? '—';
                              const selected = selectedDocIds.includes(documentId);
                              const patchBusy = patchActiveLoadingId === documentId;
                              const rqBusy = requeueLoadingId === documentId;
                              /** Re-embed is blocked only while a run is already in progress. */
                              const requeueAllowed = status !== 'processing';
                              const isQueuedRow = status === 'queued';
                              const isFailedRow = status === 'failed';
                              return (
                                <tr
                                  key={documentId || index}
                                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                                >
                                  <td className="px-2 py-2.5 align-middle sm:px-3">
                                    <Checkbox
                                      checked={selected}
                                      disabled={isPendingRow}
                                      onChange={(e) => toggleDocRowSelected(documentId, e.target.checked)}
                                      aria-label={`Select ${fileLabel}`}
                                    />
                                  </td>
                                  <td className="min-w-0 px-2 py-2.5 align-middle sm:px-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span
                                        className="inline-flex aspect-[40/48] h-6 w-auto max-h-6 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-slate-200/65 shadow-sm"
                                        title={ftLabel}
                                      >
                                        <FileIcon {...fileDocumentFileIconProps(row.fileName, row.fileType)} />
                                        <span className="sr-only">{ftLabel}</span>
                                      </span>
                                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span
                                          className="min-w-0 truncate font-normal text-slate-800"
                                          title={fileLabel}
                                        >
                                          {fileLabel}
                                        </span>
                                        <span className="text-xs tabular-nums text-slate-500">{size}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 align-middle sm:px-3">
                                    <span
                                      className={cn(
                                        'inline-flex max-w-[11rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold normal-case',
                                        status === 'ready'
                                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                                          : status === 'processing' || status === 'uploading'
                                            ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200/80'
                                            : status === 'failed'
                                              ? 'bg-red-50 text-red-800 ring-1 ring-red-200/80'
                                              : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
                                      )}
                                      title={trainingPipelineStatusLabel(status)}
                                    >
                                      {trainingPipelineStatusLabel(status)}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 align-middle sm:px-3">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <Switch
                                        checked={active}
                                        disabled={patchBusy || isPendingRow}
                                        showLabels
                                        onLabel="Yes"
                                        offLabel="No"
                                        onCheckedChange={(next) => void toggleDocIncluded(documentId, next)}
                                        aria-label={
                                          active
                                            ? 'Use in replies: Yes. Click to set to No.'
                                            : 'Use in replies: No. Click to set to Yes.'
                                        }
                                      />
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 align-middle sm:px-3">
                                    <span
                                      className={cn(
                                        'tabular-nums',
                                        documentLastTrainedIso(row) ? 'text-slate-600' : 'text-slate-400',
                                      )}
                                      title={
                                        documentLastTrainedIso(row) ?? undefined
                                      }
                                    >
                                      {isPendingRow ? '—' : formatLastTrainedCell(row)}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 align-middle text-right sm:px-3">
                                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                      {isPendingRow ? (
                                        <span className="inline-flex items-center gap-1 pr-1 text-xs font-medium text-slate-500">
                                          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                                          Uploading
                                        </span>
                                      ) : isQueuedRow ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 gap-1 px-2 text-slate-600 hover:text-slate-900"
                                          disabled={rqBusy || !requeueAllowed}
                                          onClick={() => void requeueDocument(documentId)}
                                          aria-label="Train document"
                                          title={
                                            requeueAllowed
                                              ? 'Train (start processing this file)'
                                              : 'Processing in progress'
                                          }
                                        >
                                          {rqBusy ? (
                                            <Loader2 size={16} className="animate-spin" aria-hidden />
                                          ) : (
                                            <Sparkles size={16} aria-hidden />
                                          )}
                                          <span className="text-xs font-medium">Train</span>
                                        </Button>
                                      ) : (
                                        <>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-1 px-2 text-slate-600 hover:text-slate-900"
                                            disabled={rqBusy || !requeueAllowed}
                                            onClick={() => void requeueDocument(documentId)}
                                            aria-label={isFailedRow ? 'Retry training' : 'Train document'}
                                            title={
                                              !requeueAllowed
                                                ? 'Processing in progress'
                                                : isFailedRow
                                                  ? 'Retry training (re-process this file)'
                                                  : 'Train (re-index this file for the assistant)'
                                            }
                                          >
                                            {rqBusy ? (
                                              <Loader2 size={16} className="animate-spin" aria-hidden />
                                            ) : isFailedRow ? (
                                              <RefreshCw size={16} aria-hidden />
                                            ) : (
                                              <Sparkles size={16} aria-hidden />
                                            )}
                                            <span className="text-xs font-medium">
                                              {isFailedRow ? 'Retry' : 'Train'}
                                            </span>
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-slate-500 hover:text-[var(--color-danger-text-emphasis)]"
                                            onClick={() => {
                                              setDocDeleteLoading(false);
                                              setDocDeleteTarget({ id: documentId, label: fileLabel });
                                            }}
                                            aria-label="Delete document"
                                            title="Delete"
                                          >
                                            <Trash2 size={16} aria-hidden />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {!docLoading && docFilteredRows.length > 0 ? (
                      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Per page</span>
                            <Select
                              id="kb-doc-per-page"
                              quiet
                              className="h-8 w-[4.5rem] text-sm"
                              value={String(docPerPage)}
                              onChange={(e) => {
                                setDocPerPage(Number(e.target.value));
                                setDocPage(1);
                              }}
                            >
                              <option value="5">5</option>
                              <option value="10">10</option>
                              <option value="25">25</option>
                            </Select>
                          </div>
                          <span className="text-xs text-slate-500">
                            Showing {docListRange.start}–{docListRange.end} of {docFilteredRows.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={docPage <= 1}
                            onClick={() => setDocPage((p) => Math.max(1, p - 1))}
                            aria-label="Previous page"
                          >
                            <ChevronLeft size={18} aria-hidden />
                          </Button>
                          <span className="min-w-[5rem] text-center text-xs text-slate-600">
                            Page {docPage} of {docTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={docPage >= docTotalPages}
                            onClick={() => setDocPage((p) => Math.min(docTotalPages, p + 1))}
                            aria-label="Next page"
                          >
                            <ChevronRight size={18} aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'faqs' ? (
              <Card className={cardClass}>
                <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                  <section className={styles.workspaceEditorCardSection} aria-labelledby="knowledge-faqs">
                    <WorkspaceSectionHeader
                      id="knowledge-faqs"
                      title="Questions & answers"
                      description={faqHeaderDescription}
                      inlineEnd={
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setFaqModal({ mode: 'create', index: -1, question: '', answer: '' })
                          }
                        >
                          Add Q&amp;A
                        </Button>
                      }
                    />
                    {faqs.length > 2 || faqQuery.trim() ? (
                      <div className="mt-4">
                        <FieldRow
                          label="Search"
                          htmlFor="knowledge-faq-search"
                          helperText={
                            faqs.length > 2
                              ? 'Filter by words in the question or answer.'
                              : 'Showing search because a filter is active.'
                          }
                          className="max-w-md"
                        >
                          <Input
                            id="knowledge-faq-search"
                            quiet
                            value={faqQuery}
                            onChange={(e) => setFaqQuery(e.target.value)}
                            placeholder="Search FAQs…"
                            leadingIcon={<Search size={16} strokeWidth={2} className="text-slate-400" aria-hidden />}
                            autoComplete="off"
                          />
                        </FieldRow>
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-2">
                      {faqs.length === 0 ? (
                        <div
                          className={cn(
                            'rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-5 py-8 text-center',
                          )}
                        >
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80">
                            <MessageCircleQuestion size={20} strokeWidth={1.75} className="text-teal-600" aria-hidden />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900">No Q&amp;A yet</p>
                          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
                            Add pairs for pricing, hours, shipping, or policies—keep answers short and factual.
                          </p>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="mt-5"
                            onClick={() =>
                              setFaqModal({ mode: 'create', index: -1, question: '', answer: '' })
                            }
                          >
                            Add your first Q&amp;A
                          </Button>
                        </div>
                      ) : faqEntries.length === 0 ? (
                        <div className={styles.knowledgeEmpty}>
                          <p className="m-0">No matches for &ldquo;{faqQuery.trim()}&rdquo;.</p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-3"
                            onClick={() => setFaqQuery('')}
                          >
                            Clear search
                          </Button>
                        </div>
                      ) : (
                        faqEntries.map(({ faq, index: i }) => {
                          const q = faq.question.trim() || 'Untitled question';
                          const answerPreview = previewText(faq.answer.trim() || 'No answer yet.', 180);
                          return (
                            <article
                              key={i}
                              className="rounded-lg border border-slate-200/80 bg-white ring-1 ring-slate-900/[0.02] transition-colors hover:border-slate-300/90"
                            >
                              <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold tabular-nums text-slate-600"
                                  aria-hidden
                                >
                                  {i + 1}
                                </div>
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 rounded-md text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                                  onClick={() =>
                                    setFaqModal({
                                      mode: 'edit',
                                      index: i,
                                      question: faq.question,
                                      answer: faq.answer,
                                    })
                                  }
                                >
                                  <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                                    Question
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{q}</p>
                                  <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                                    Answer
                                  </p>
                                  <p className="mt-0.5 line-clamp-3 text-sm leading-relaxed text-slate-600">
                                    {answerPreview}
                                  </p>
                                </button>
                                <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-start">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="gap-0 px-2"
                                    onClick={() =>
                                      setFaqModal({
                                        mode: 'edit',
                                        index: i,
                                        question: faq.question,
                                        answer: faq.answer,
                                      })
                                    }
                                    aria-label={`Edit: ${q}`}
                                  >
                                    <Pencil size={14} strokeWidth={2} aria-hidden />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="px-2 text-[var(--color-danger-text-emphasis)] hover:bg-[var(--color-danger-bg)]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFaqDeleteIndex(i);
                                    }}
                                    aria-label={`Delete: ${q}`}
                                  >
                                    <Trash2 size={14} strokeWidth={2} aria-hidden />
                                  </Button>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                </CardBody>
              </Card>
            ) : null}

            {activeTab === 'notes' ? (
              <Card className={cardClass}>
                <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                  <section className={styles.workspaceEditorCardSection} aria-labelledby="knowledge-notes">
                    <WorkspaceSectionHeader
                      id="knowledge-notes"
                      title="Notes"
                      description="Add freeform context your assistant can use while answering."
                    />
                    <div className="mt-4">
                      <FieldRow
                        label="Knowledge notes"
                        htmlFor="knowledge-notes-text"
                        helperText="Keep this focused on evergreen context, policies, and important details."
                      >
                        <Textarea
                          id="knowledge-notes-text"
                          quiet
                          rows={12}
                          value={snippet}
                          onChange={(e) => {
                            setSnippet(e.target.value);
                            markNotesDirty();
                          }}
                        />
                      </FieldRow>
                    </div>
                  </section>
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      </form>

      <Modal
        open={faqModal != null}
        onClose={() => {
          setFaqModal(null);
          setFaqModalAttempted(false);
        }}
        title={faqModal?.mode === 'create' ? 'Add question & answer' : 'Edit question & answer'}
        description="Visitors may ask similar questions—keep the question natural and the answer direct."
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={faqSaving}
              onClick={() => {
                setFaqModal(null);
                setFaqModalAttempted(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={faqFormId}
              variant="primary"
              size="sm"
              disabled={faqSaving}
              className="gap-1.5"
              aria-busy={faqSaving || undefined}
            >
              {faqSaving ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                  {faqModal?.mode === 'create' ? 'Adding…' : 'Saving…'}
                </>
              ) : faqModal?.mode === 'create' ? (
                'Add to list'
              ) : (
                'Save changes'
              )}
            </Button>
          </>
        }
      >
        <form
          id={faqFormId}
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            commitFaqModal();
          }}
        >
          <FieldRow
            label="Question"
            htmlFor="knowledge-faq-question"
            helperText="Phrase it like a customer would (not keywords only)."
            error={
              faqModalAttempted && !String(faqModal?.question ?? '').trim()
                ? 'Enter a question.'
                : undefined
            }
          >
            <Input
              ref={faqQuestionInputRef}
              id="knowledge-faq-question"
              quiet
              value={faqModal?.question ?? ''}
              invalid={Boolean(faqModalAttempted && !String(faqModal?.question ?? '').trim())}
              onChange={(e) =>
                setFaqModal((prev) => (prev ? { ...prev, question: e.target.value } : prev))
              }
              placeholder="What are your support hours?"
              autoComplete="off"
            />
          </FieldRow>
          <FieldRow
            label="Answer"
            htmlFor="knowledge-faq-answer"
            helperText="Aim for one short paragraph. You can edit again anytime."
            error={
              faqModalAttempted && !String(faqModal?.answer ?? '').trim()
                ? 'Enter an answer.'
                : undefined
            }
          >
            <Textarea
              id="knowledge-faq-answer"
              quiet
              rows={7}
              value={faqModal?.answer ?? ''}
              invalid={Boolean(faqModalAttempted && !String(faqModal?.answer ?? '').trim())}
              onChange={(e) =>
                setFaqModal((prev) => (prev ? { ...prev, answer: e.target.value } : prev))
              }
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (!(e.metaKey || e.ctrlKey)) return;
                e.preventDefault();
                commitFaqModal();
              }}
              placeholder="We provide support Monday to Friday, 9am to 6pm (local time)."
            />
          </FieldRow>
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            Tip: <span className="font-medium text-slate-600">Ctrl+Enter</span> saves from the answer field.
          </p>
        </form>
      </Modal>

      <Modal
        open={faqDeleteIndex != null}
        onClose={() => setFaqDeleteIndex(null)}
        title="Delete this Q&A?"
        tone="danger"
        description={
          faqDeleteIndex != null && faqs[faqDeleteIndex] ? (
            <span className="font-medium text-slate-800">
              &ldquo;
              {previewText(faqs[faqDeleteIndex].question.trim() || 'Untitled', 100)}
              &rdquo;
            </span>
          ) : (
            'This permanently deletes the pair. This action cannot be undone.'
          )
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={faqSaving}
              onClick={() => setFaqDeleteIndex(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={faqSaving}
              className="gap-1.5"
              aria-busy={faqSaving || undefined}
              onClick={() => {
                void (async () => {
                  const idx = faqDeleteIndex;
                  if (idx == null) return;
                  const next = faqsRef.current.filter((_, i) => i !== idx);
                  const r = await persistFaqs(next);
                  if (!r.ok) {
                    appToast.error('Could not delete Q&A', { description: r.error });
                    return;
                  }
                  setFaqDeleteIndex(null);
                  queueMicrotask(() =>
                    appToast.success('Q&A removed', {
                      description: 'That entry is no longer in this assistant’s list.',
                    }),
                  );
                })();
              }}
            >
              {faqSaving ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete Q&A'
              )}
            </Button>
          </>
        }
      >
        <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
          You can add this question again later with <span className="font-medium text-slate-700">Add Q&amp;A</span>.
        </p>
      </Modal>

      <Modal
        open={docDeleteTarget != null}
        onClose={closeDocDeleteModal}
        title="Delete document?"
        tone="danger"
        description={
          docDeleteTarget ? (
            <span className="font-medium text-slate-800">
              &ldquo;{previewText(docDeleteTarget.label, 100)}&rdquo; — this action cannot be undone.
            </span>
          ) : (
            'This permanently deletes the document. This action cannot be undone.'
          )
        }
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" disabled={docDeleteLoading} onClick={closeDocDeleteModal}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="gap-1.5"
              disabled={docDeleteLoading}
              aria-busy={docDeleteLoading || undefined}
              onClick={() => {
                const t = docDeleteTarget;
                if (!t) return;
                void (async () => {
                  setDocDeleteLoading(true);
                  try {
                    const r = await removeDoc(t.id);
                    if (!r.ok) {
                      appToast.error('Could not delete document', { description: r.error });
                      return;
                    }
                    closeDocDeleteModal();
                    queueMicrotask(() =>
                      appToast.success('Document removed', {
                        description: 'It is no longer part of this assistant’s knowledge base.',
                      }),
                    );
                  } finally {
                    setDocDeleteLoading(false);
                  }
                })();
              }}
            >
              {docDeleteLoading ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete document'
              )}
            </Button>
          </>
        }
      >
        <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
          This removes the file from this assistant&apos;s knowledge base. Upload it again if you change your mind.
        </p>
      </Modal>
    </div>
  );
}

export function KnowledgeSection() {
  return <KnowledgeBaseSection />;
}
