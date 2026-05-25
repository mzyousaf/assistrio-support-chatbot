import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { appToast } from '@/lib/app-toast';
import { FileIcon, defaultStyles } from 'react-file-icon';
import {
  Check,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES,
  CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE,
  KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX,
  KNOWLEDGE_DOCUMENTS_MAX,
} from '@/lib/botFieldLimits';
import {
  ASSISTRIO_WORKSPACE_BOT_REFRESH,
  requestWorkspaceBotRefresh,
  type WorkspaceBotRefreshDetail,
} from '@/lib/botSyncEvents';
import {
  deleteCustomerBotDocument,
  getCustomerBotDocuments,
  getCustomerBotKnowledgeOverview,
  patchCustomerBotDocument,
  postCustomerBotDocumentUpload,
  postCustomerBotDocumentsBulkDelete,
} from '../../api/customerApi';
import { customerDocumentDeleteResolved } from '../../api/customerDeleteResult';
import type { CustomerWorkspaceDocument } from '../../api/types';
import {
  knowledgeDocumentActivityCellText,
  knowledgeTrainingStatusLabel,
  baselineDocumentRowTrainingStatus,
} from '@/lib/knowledgeTrainingStatus';
import {
  useKbKnowledgeStatusPollInterest,
  useKbWorkspacePolling,
} from '@/context/KbWorkspacePollingContext';
import { useKnowledgeStorageUx } from '@/context/KnowledgeStorageUxContext';
import {
  documentBatchCountLimitMessageFromApi,
  isPlanLimitDocumentBatchCountApiResult,
  isPlanLimitKnowledgeDocumentsCountApiResult,
  KNOWLEDGE_DOC_UPLOAD_FILESIZE_VS_QUOTA_MESSAGE,
  knowledgeDocumentsCountLimitMessageFromApi,
} from '@/lib/knowledgeStorageLimits';
import type { WorkspaceDocumentDisplayOptions } from '@/lib/knowledgeItemDisplayStatus';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import {
  findKnowledgeStatusItemById,
  isKnowledgeTrainingMutationBlocked,
} from '@/lib/knowledgeTrainingMutationGate';
import {
  mergeDocumentRowsWithKbStatusPoll,
  type DocumentRowWithKbMeta,
  documentRowLastTrainedIso,
  coerceDocumentPipelineStage,
  formatDocumentCharacterCountSizeLabel,
  formatDocumentTrainingStatusDisplayLabel,
  formatKbItemLastTrainedRelative,
  workspaceDocumentPrimaryName,
} from './knowledge/knowledgeViewTypes';
import { useKbTrainingStartedStatusRefetch } from './knowledge/useKbTrainingStartedStatusRefetch';
import { useBotWorkspace } from './BotWorkspaceContext';
import { ReadOnlyWorkspaceNotice } from '@/components/workspace/ReadOnlyWorkspaceNotice';
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
  Switch,
} from '@/components/ui';
import { DocumentKbTrainingStatusTag, DocumentListRowSizeWithTrainingCountdown } from '@/components/knowledge/KbTrainingStatusTag';
import { knowledgeDocumentsListCache } from './knowledge/knowledgeRouteDataCache';
import { KnowledgeDocumentsTableSkeleton } from './knowledge/knowledgeScreenSkeletons';
import {
  clampKnowledgeSourcesPageSize,
  KnowledgeSourcesBulkBar,
  KnowledgeSourcesPagination,
  useKnowledgeTrainingGateModal,
} from './knowledge/knowledgeSourcesListUi';

const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

/** Upload drop zone only: no raised white panel; dashed inner area carries the affordance. */
const uploadDocumentsCardClass =
  'w-full min-w-0 overflow-visible border-0 bg-transparent shadow-none ring-0';

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

/** List default: newest uploads first (pending rows on top, then `createdAt` descending). */
function workspaceDocumentListRecencyMs(row: CustomerWorkspaceDocument): number {
  const id = docId(row);
  if (isClientPendingDocumentId(id)) return Number.MAX_SAFE_INTEGER;
  const c = row.createdAt;
  if (c instanceof Date && !Number.isNaN(c.getTime())) return c.getTime();
  if (typeof c === 'string' && c.trim()) {
    const t = Date.parse(c);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function newClientPendingDocumentId(): string {
  const c = globalThis.crypto?.randomUUID?.();
  return `${CLIENT_PENDING_DOC_PREFIX}${c ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function previewText(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

/** When ingest finished successfully (`ready`), ISO time of last training; otherwise null. */
function documentLastTrainedIso(row: Record<string, unknown>): string | null {
  if (baselineDocumentRowTrainingStatus(row as CustomerWorkspaceDocument) !== 'ready') return null;
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

type DocStatusFilter = 'all' | 'pending' | 'queued' | 'processing' | 'ready' | 'failed';

function documentTrainingStatusLabel(status: DocStatusFilter | Exclude<DocStatusFilter, 'all'>): string {
  if (status === 'all') return 'All';
  return knowledgeTrainingStatusLabel(status);
}

function documentUploadLifecycleStatus(row: CustomerWorkspaceDocument): string {
  return String((row as { uploadStatus?: unknown }).uploadStatus ?? (row as { documentStatus?: unknown }).documentStatus ?? '')
    .trim()
    .toLowerCase();
}

function isUploadedDocumentForTraining(row: CustomerWorkspaceDocument): boolean {
  const up = documentUploadLifecycleStatus(row);
  if (!up) return true;
  return up === 'uploaded';
}

/** Client pending row, or server row still in upload pipeline — status column stays neutral; spinner only in actions. */
function isDocumentRowUploadInProgress(row: CustomerWorkspaceDocument, isClientPending: boolean): boolean {
  if (isClientPending) return true;
  const up = String((row as { uploadStatus?: unknown }).uploadStatus ?? '')
    .trim()
    .toLowerCase();
  if (up === 'uploading') return true;
  const docSt = String((row as { documentStatus?: unknown }).documentStatus ?? '')
    .trim()
    .toLowerCase();
  if (docSt === 'uploading') return true;
  const legacySt = String((row as { status?: unknown }).status ?? '').trim().toLowerCase();
  return legacySt === 'uploading';
}

function canShowDocumentRowDelete(row: CustomerWorkspaceDocument, isPendingRow: boolean): boolean {
  if (isPendingRow) return false;
  if (baselineDocumentRowTrainingStatus(row) === 'ready') return true;
  const up = documentUploadLifecycleStatus(row);
  if (up === 'upload_failed') return true;
  return isUploadedDocumentForTraining(row) && row.isContentExtracted === true;
}

const DOC_STATUS_FILTERS: { id: DocStatusFilter; label: string }[] = [
  { id: 'pending', label: documentTrainingStatusLabel('pending') },
  { id: 'queued', label: documentTrainingStatusLabel('queued') },
  { id: 'processing', label: documentTrainingStatusLabel('processing') },
  { id: 'ready', label: documentTrainingStatusLabel('ready') },
  { id: 'failed', label: documentTrainingStatusLabel('failed') },
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
  const { bot, botId, canManageBot } = useBotWorkspace();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const {
    notifyPlanLimitFromApi,
    interceptKnowledgeStorageIncrease,
    knowledgeUsage,
    showStorageFullModal,
    confirmLowStorageWarning,
  } = useKnowledgeStorageUx();
  const navigate = useNavigate();
  const kbBase = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const docPerPageSelectId = useId();
  const [rows, setRows] = useState<DocumentRowWithKbMeta[]>([]);
  const [documentCountWithPending, setDocumentCountWithPending] = useState(0);
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
  const [patchActiveLoadingId, setPatchActiveLoadingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const tableSelectAllRef = useRef<HTMLInputElement | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  /** True while refetching when we already show rows — avoids swapping the whole table for “Loading…”. */
  const [docListRefreshing, setDocListRefreshing] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [docDeleteTarget, setDocDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [docDeleteLoading, setDocDeleteLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentDisplayOpts, setDocumentDisplayOpts] = useState<WorkspaceDocumentDisplayOptions>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Client-only placeholder rows while multipart upload is in flight (survive background list refresh). */
  const pendingDocUploadIdsRef = useRef<Set<string>>(new Set());
  /** Keeps latest row count for soft reload without stale `rows` in `loadDocs` closures. */
  const rowsLengthRef = useRef(0);

  function closeDocDeleteModal() {
    setDocDeleteTarget(null);
    setDocDeleteLoading(false);
  }

  function closeBulkDeleteConfirmModal() {
    if (bulkDeleting) return;
    setBulkDeleteConfirmOpen(false);
  }

  const knowledgePageMeta = {
    pageTitle: 'Documents',
    pageLead:
      'Long-form files your Agent learns from. Upload below, or open one from the list. Extracted text is trained and used in replies when the file is on.',
  };

  const closeDocFilterMenu = useCallback(() => setOpenDocFilter(null), []);

  const loadDocs = useCallback(async (opts?: { background?: boolean }) => {
    if (!botId) return;
    const wid = botId;
    const hasLocalRows =
      rowsLengthRef.current > 0 || pendingDocUploadIdsRef.current.size > 0;
    const soft = opts?.background === true || hasLocalRows;
    if (!soft) {
      setDocLoading(true);
      setDocListRefreshing(false);
    } else {
      setDocListRefreshing(true);
    }
    setDocErr(null);
    try {
      const res = await getCustomerBotDocuments(wid, { page: 1, limit: 100 });
      if (!res.ok) {
        setDocErr(res.error);
        if (!knowledgeDocumentsListCache.has(wid)) {
          setRows([]);
          rowsLengthRef.current = 0;
          setDocumentCountWithPending(0);
        }
        return;
      }
      const serverDocs = res.data.documents ?? [];
      knowledgeDocumentsListCache.set(wid, {
        rows: serverDocs.map((d) => ({ ...(d as CustomerWorkspaceDocument) })),
        total: Number(res.data.total ?? 0) || 0,
      });
      setRows((prev) => {
        const pending = prev.filter(
          (r) => isClientPendingDocumentId(docId(r)) && pendingDocUploadIdsRef.current.has(docId(r)),
        );
        const serverIds = new Set(serverDocs.map((d) => docId(d as CustomerWorkspaceDocument)));
        const pendingOnly = pending.filter((p) => !serverIds.has(docId(p)));
        const withMeta: DocumentRowWithKbMeta[] = serverDocs.map((d) => {
          const base = d as CustomerWorkspaceDocument;
          const id = docId(base);
          const oldKb = prev.find((r) => docId(r) === id)?.knowledgeItemId;
          return oldKb ? { ...base, knowledgeItemId: oldKb } : { ...base };
        });
        return [...pendingOnly, ...withMeta];
      });
      const extraPending = pendingDocUploadIdsRef.current.size;
      const baseTotal = Number(res.data.total ?? 0) || 0;
      setDocumentCountWithPending(baseTotal + extraPending);
    } finally {
      setDocLoading(false);
      setDocListRefreshing(false);
    }
  }, [botId]);

  /**
   * Documents list remount (e.g. return from detail): never hydrate from cache before fetch — that painted stale
   * counts with “Updating…” while GET `/documents` caught up. Reset rows and show the table skeleton until loadDocs finishes.
   */
  useLayoutEffect(() => {
    if (!botId) {
      setRows([]);
      rowsLengthRef.current = 0;
      setDocumentCountWithPending(0);
      setDocErr(null);
      setDocListRefreshing(false);
      setDocLoading(false);
      return;
    }
    setRows([]);
    rowsLengthRef.current = 0;
    setDocumentCountWithPending(0);
    setDocErr(null);
    setDocListRefreshing(false);
    setDocLoading(true);
  }, [botId]);

  useEffect(() => {
    if (!botId) return;
    void loadDocs();
  }, [botId, loadDocs]);

  useKbTrainingStartedStatusRefetch(botId, 'document');

  useKbKnowledgeStatusPollInterest(Boolean(botId), 'document');

  const docStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'document'),
    [knowledgeStatusItems],
  );
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();
  const docPollForGate = useCallback(
    (row: DocumentRowWithKbMeta) => {
      const kid = row.knowledgeItemId?.trim();
      if (kid) return findKnowledgeStatusItemById(docStatusSlice, kid) ?? null;
      const id = docId(row);
      return (
        docStatusSlice.find((it) => String(it.documentId ?? '') === id || String(it.id ?? '') === id) ?? null
      );
    },
    [docStatusSlice],
  );

  useEffect(() => {
    if (knowledgeStatusItems == null) return;
    const slice = filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'document');
    setRows((prev) =>
      mergeDocumentRowsWithKbStatusPoll(prev, slice, (row) => docId(row), isClientPendingDocumentId),
    );
  }, [knowledgeStatusItems]);

  const atDocumentCapacity = documentCountWithPending >= KNOWLEDGE_DOCUMENTS_MAX;

  /** Counts by indexing step / pipeline status (full list — for filter). */
  const docStatusCounts = useMemo(() => {
    const c = {
      all: rows.length,
      pending: 0,
      queued: 0,
      processing: 0,
      ready: 0,
      failed: 0,
    };
    for (const r of rows) {
      const id = docId(r);
      if (isClientPendingDocumentId(id)) continue;
      const up = documentUploadLifecycleStatus(r as CustomerWorkspaceDocument);
      if (up === 'uploading') continue;
      if (up === 'upload_failed') {
        c.failed += 1;
        continue;
      }
      if (!isUploadedDocumentForTraining(r as CustomerWorkspaceDocument)) continue;
      const cst = baselineDocumentRowTrainingStatus(r as CustomerWorkspaceDocument);
      if (cst === 'pending') c.pending += 1;
      else if (cst === 'queued') c.queued += 1;
      else if (cst === 'processing') c.processing += 1;
      else if (cst === 'ready') c.ready += 1;
      else if (cst === 'failed') c.failed += 1;
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
        const up = documentUploadLifecycleStatus(r as CustomerWorkspaceDocument);
        if (docStatusFilter === 'failed') {
          if (up === 'upload_failed') return true;
        } else if (!isUploadedDocumentForTraining(r as CustomerWorkspaceDocument)) {
          return false;
        }
        const cst = baselineDocumentRowTrainingStatus(r as CustomerWorkspaceDocument);
        return cst === docStatusFilter;
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
        const canonSt = baselineDocumentRowTrainingStatus(r as CustomerWorkspaceDocument);
        const stLabel = documentTrainingStatusLabel(canonSt as Exclude<DocStatusFilter, 'all'>).toLowerCase();
        const pipeSt = coerceDocumentPipelineStage(r as CustomerWorkspaceDocument) ?? '';
        const displayStatusLabel = formatDocumentTrainingStatusDisplayLabel(
          r as CustomerWorkspaceDocument,
          documentDisplayOpts,
        ).toLowerCase();
        const id = docId(r).toLowerCase();
        const usage = r.active !== false ? 'active' : 'inactive';
        const trainedLabel = knowledgeDocumentActivityCellText(r).toLowerCase();
        return (
          title.includes(q) ||
          fileName.includes(q) ||
          ft.includes(q) ||
          canonSt.includes(q) ||
          stLabel.includes(q) ||
          pipeSt.includes(q) ||
          displayStatusLabel.includes(q) ||
          id.includes(q) ||
          usage.includes(q) ||
          trainedLabel.includes(q)
        );
      });
    }
    return list
      .slice()
      .sort((a, b) => workspaceDocumentListRecencyMs(b) - workspaceDocumentListRecencyMs(a));
  }, [docRowsAfterPipelineFilters, docSearchQuery, documentDisplayOpts]);

  const docTotalPages = useMemo(
    () => Math.max(1, Math.ceil(docFilteredRows.length / docPerPage) || 1),
    [docFilteredRows.length, docPerPage],
  );

  const docPaginatedRows = useMemo(() => {
    const start = (docPage - 1) * docPerPage;
    return docFilteredRows.slice(start, start + docPerPage);
  }, [docFilteredRows, docPage, docPerPage]);

  const docAllServerPageIds = useMemo(
    () =>
      docPaginatedRows
        .map((r) => docId(r))
        .filter((id) => id && !isClientPendingDocumentId(id)),
    [docPaginatedRows],
  );

  const docBulkSelectablePageIds = useMemo(
    () =>
      docPaginatedRows
        .map((r) => {
          const id = docId(r);
          if (!id || isClientPendingDocumentId(id)) return null;
          const docRow = r as CustomerWorkspaceDocument;
          const isPendingRow = isClientPendingDocumentId(id);
          if (isDocumentRowUploadInProgress(docRow, isPendingRow)) return null;
          if (isKnowledgeTrainingMutationBlocked(docPollForGate(r as DocumentRowWithKbMeta), r)) return null;
          return id;
        })
        .filter((id): id is string => Boolean(id)),
    [docPaginatedRows, docPollForGate],
  );

  const docAllOnPageSelected = useMemo(() => {
    return (
      docBulkSelectablePageIds.length > 0 &&
      docBulkSelectablePageIds.every((id) => selectedDocIds.includes(id))
    );
  }, [docBulkSelectablePageIds, selectedDocIds]);

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
    if (!botId) return;
    let cancelled = false;
    const loadOverview = () => {
      void getCustomerBotKnowledgeOverview(botId).then((res) => {
        if (cancelled || !res.ok) return;
        setDocumentDisplayOpts({ autoTrainEnabled: Boolean(res.data.knowledgeTraining.autoTrainEnabled) });
      });
    };
    loadOverview();
    const onRefresh = (e: Event) => {
      const d = (e as CustomEvent<WorkspaceBotRefreshDetail>).detail;
      if (d?.botId !== botId) return;
      loadOverview();
    };
    window.addEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onRefresh);
    };
  }, [botId]);

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
    const n = docAllServerPageIds.filter((id) => selectedDocIds.includes(id)).length;
    const allEligibleSelected =
      docBulkSelectablePageIds.length > 0 &&
      docBulkSelectablePageIds.every((id) => selectedDocIds.includes(id));
    el.indeterminate = n > 0 && !allEligibleSelected;
  }, [docAllServerPageIds, docBulkSelectablePageIds, selectedDocIds]);

  async function removeDoc(documentIdToRemove: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!documentIdToRemove) return { ok: false, error: 'Missing document.' };
    if (isClientPendingDocumentId(documentIdToRemove)) {
      pendingDocUploadIdsRef.current.delete(documentIdToRemove);
      setRows((prev) => prev.filter((r) => docId(r) !== documentIdToRemove));
      setSelectedDocIds((prev) => prev.filter((id) => id !== documentIdToRemove));
      setDocumentCountWithPending((t) => Math.max(0, t - 1));
      if (botId) {
        requestWorkspaceBotRefresh(botId, { affectedSections: ['document'], refreshDocumentsList: true });
      }
      return { ok: true };
    }
    if (!botId) return { ok: false, error: 'Missing assistant.' };
    const res = await deleteCustomerBotDocument(botId, documentIdToRemove);
    if (!customerDocumentDeleteResolved(res)) {
      const err = !res.ok ? res.error : 'Could not remove document';
      setDocErr(err);
      return { ok: false, error: err };
    }
    setRows((prev) => prev.filter((r) => docId(r) !== documentIdToRemove));
    setSelectedDocIds((prev) => prev.filter((id) => id !== documentIdToRemove));
    requestWorkspaceBotRefresh(botId, { affectedSections: ['document'], refreshDocumentsList: true });
    void loadDocs({ background: true });
    void refreshTrainingStatus();
    void refreshKnowledgeStatus('document');
    return { ok: true };
  }

  function bumpDocCountsForPendingUpload() {
    setDocumentCountWithPending((t) => t + 1);
  }

  function rollbackDocCountsForPendingUpload() {
    setDocumentCountWithPending((t) => Math.max(0, t - 1));
  }

  async function uploadFilesFromPicker(files: File[]) {
    if (!botId) return;
    const list = files.filter((f) => f.size > 0);
    if (list.length === 0) return;
    const oversize = list.filter((f) => f.size > CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES);
    if (oversize.length > 0) {
      appToast.error('File too large', {
        description:
          `${CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE} ${oversize.length === 1 ? oversize[0]!.name : `${oversize.length} files`} skipped.`,
      });
    }
    const listWithinLimit = list.filter((f) => f.size <= CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES);
    if (listWithinLimit.length === 0) return;

    const slotsRemaining = Math.max(0, KNOWLEDGE_DOCUMENTS_MAX - documentCountWithPending);
    if (slotsRemaining <= 0) {
      appToast.error('Document limit reached', {
        description: `Each agent can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. Remove one to upload more.`,
      });
      return;
    }

    let capacityLimited = listWithinLimit;
    if (listWithinLimit.length > slotsRemaining) {
      const dropped = listWithinLimit.length - slotsRemaining;
      capacityLimited = listWithinLimit.slice(0, slotsRemaining);
      appToast.info('Some files were not added', {
        description: `You can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. ${dropped} file${dropped === 1 ? '' : 's'} skipped.`,
      });
    }

    let toUpload = capacityLimited;
    if (capacityLimited.length > KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX) {
      const rejectedCount = capacityLimited.length - KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX;
      toUpload = capacityLimited.slice(0, KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX);
      appToast.info('Some files were not added', {
        description: `You can upload up to ${KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX} files at a time. ${rejectedCount} file${rejectedCount === 1 ? '' : 's'} were not added.`,
      });
    }

    if (toUpload.length === 0) return;

    const uploadBytesApprox = toUpload.reduce((sum, f) => sum + f.size, 0);
    const usage = knowledgeUsage;
    if (usage && Number.isFinite(usage.maxBytes) && usage.maxBytes > 0) {
      const { totalBytes, maxBytes } = usage;
      if (totalBytes >= maxBytes) {
        showStorageFullModal();
        return;
      }
      if (totalBytes + uploadBytesApprox > maxBytes) {
        if (!(await confirmLowStorageWarning(KNOWLEDGE_DOC_UPLOAD_FILESIZE_VS_QUOTA_MESSAGE))) {
          return;
        }
      } else if (!(await interceptKnowledgeStorageIncrease(uploadBytesApprox))) {
        return;
      }
    } else if (!(await interceptKnowledgeStorageIncrease(uploadBytesApprox))) {
      return;
    }

    setUploading(true);
    const n = toUpload.length;
    appToast.info(n === 1 ? 'Upload started' : `Upload started · ${n} files`, {
      description:
        n === 1
          ? 'Your file is uploading. The Training status column will show Uploading, then Extracting, then training steps as they run.'
          : 'Your files are uploading in the background. Each row updates in the Training column through upload, text extraction, and training.',
    });
    const errors: string[] = [];
    let totalSuccess = 0;
    let lastTitle = '';
    try {
      for (let offset = 0; offset < toUpload.length; offset += KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX) {
        const chunk = toUpload.slice(offset, offset + KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX);
        const pendingMetas: { pendingId: string; file: File }[] = [];

        for (const file of chunk) {
          const pendingId = newClientPendingDocumentId();
          pendingDocUploadIdsRef.current.add(pendingId);
          pendingMetas.push({ pendingId, file });
          const pendingRow: CustomerWorkspaceDocument = {
            _id: pendingId,
            title: file.name,
            status: 'uploading',
            uploadStatus: 'uploading',
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
          if (notifyPlanLimitFromApi(res)) {
            continue;
          }
          if (isPlanLimitDocumentBatchCountApiResult(res)) {
            appToast.error('Too many files', {
              description: documentBatchCountLimitMessageFromApi(res),
            });
            void loadDocs({ background: true });
            continue;
          }
          if (isPlanLimitKnowledgeDocumentsCountApiResult(res)) {
            appToast.error('Document limit reached', {
              description: knowledgeDocumentsCountLimitMessageFromApi(res),
            });
            void loadDocs({ background: true });
            continue;
          }
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

        const realRows: DocumentRowWithKbMeta[] = docs.map((d) => ({
          _id: d._id,
          title: d.title,
          status: d.documentStatus ?? d.status,
          documentStatus: d.documentStatus,
          trainingStatus: d.trainingStatus,
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
          const withKb: DocumentRowWithKbMeta[] = realRows.map((row) => {
            const id = docId(row);
            const kb = prev.find((r) => docId(r) === id)?.knowledgeItemId;
            return kb ? { ...row, knowledgeItemId: kb } : row;
          });
          return [...withKb, ...base];
        });

        totalSuccess += docs.length;
        lastTitle = docs[docs.length - 1]?.title ?? lastTitle;
      }

      if (totalSuccess > 0 && errors.length === 0) {
        appToast.success(
          totalSuccess === 1 ? `“${lastTitle}” uploaded` : `${totalSuccess} files uploaded`,
          {
            description:
              totalSuccess === 1
                ? 'Text extraction runs next; training follows when your workspace settings allow it. Watch the Training status column for each step.'
                : 'Each file is extracted first, then moves into training when applicable. Watch the Training status column for each file.',
          },
        );
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
      if (totalSuccess > 0) {
        void refreshTrainingStatus();
        void refreshKnowledgeStatus('document');
      }
      if (botId && (totalSuccess > 0 || errors.length > 0)) {
        requestWorkspaceBotRefresh(botId, {
          affectedSections: ['document'],
          refreshDocumentsList: totalSuccess > 0,
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
      if (notifyPlanLimitFromApi(res)) {
        return;
      }
      setDocErr(res.error);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (docId(r) === documentId ? { ...(r as CustomerWorkspaceDocument), active } : r)),
    );
    requestWorkspaceBotRefresh(botId, { affectedSections: ['document'] });
  }

  function requestBulkDocDelete() {
    const serverIds = selectedDocIds.filter((id) => !isClientPendingDocumentId(id));
    for (const id of serverIds) {
      const row = rows.find((r) => docId(r) === id);
      if (!row) continue;
      if (blockIfTrainingForItem(docPollForGate(row), row)) return;
    }
    setBulkDeleteConfirmOpen(true);
  }

  async function bulkDeleteSelectedDocs() {
    if (!botId || selectedDocIds.length === 0) {
      setBulkDeleteConfirmOpen(false);
      return;
    }
    const serverIds = selectedDocIds.filter((id) => !isClientPendingDocumentId(id));
    if (serverIds.length === 0) {
      setSelectedDocIds([]);
      setBulkDeleteConfirmOpen(false);
      return;
    }
    for (const id of serverIds) {
      const row = rows.find((r) => docId(r) === id);
      if (!row) continue;
      if (
        blockIfTrainingForItem(docPollForGate(row), row, {
          onAcknowledge: () => setBulkDeleteConfirmOpen(false),
        })
      ) {
        return;
      }
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
    setBulkDeleteConfirmOpen(false);
    setRows((prev) => prev.filter((r) => !serverIds.includes(docId(r))));
    requestWorkspaceBotRefresh(botId, { affectedSections: ['document'], refreshDocumentsList: true });
    void loadDocs({ background: true });
    void refreshTrainingStatus();
    void refreshKnowledgeStatus('document');
  }

  function toggleDocRowSelected(documentId: string, selected: boolean) {
    setSelectedDocIds((prev) => {
      if (selected) return prev.includes(documentId) ? prev : [...prev, documentId];
      return prev.filter((x) => x !== documentId);
    });
  }

  function toggleSelectAllDocsOnPage(selected: boolean) {
    setSelectedDocIds((prev) => {
      if (selected) {
        return Array.from(new Set([...prev, ...docBulkSelectablePageIds]));
      }
      return prev.filter((id) => !docAllServerPageIds.includes(id));
    });
  }

  rowsLengthRef.current = rows.length;

  if (!bot || !botId) return null;

  const bulkDeleteServerCount = selectedDocIds.filter((id) => !isClientPendingDocumentId(id)).length;
  const bulkDeletePendingCount = selectedDocIds.length - bulkDeleteServerCount;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-knowledge-base-editor>
      {canManageBot ? (
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        className="hidden"
        tabIndex={-1}
        onChange={(ev) => void onUploadFileChange(ev)}
      />
      ) : null}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <div className="w-full min-w-0 flex-1 pb-10">
          {!canManageBot ? <ReadOnlyWorkspaceNotice variant="knowledge" className="mb-4 shrink-0" /> : null}
          <header className={styles.workspaceEditorPageHeader}>
            <div className={styles.workspaceEditorTitleBlock}>
              <div className={styles.workspaceEditorHeadingStack}>
                <h1 className={styles.workspaceEditorH1}>{knowledgePageMeta.pageTitle}</h1>
                <p className={styles.workspaceEditorLead}>{knowledgePageMeta.pageLead}</p>
              </div>
            </div>
            {canManageBot ? (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:pt-0">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={uploading || atDocumentCapacity}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  styles.workspaceEditorButtonLabel,
                  'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                )}
                aria-busy={uploading || undefined}
              >
                <Upload size={15} strokeWidth={2} aria-hidden />
                {uploading ? 'Uploading' : atDocumentCapacity ? 'Document limit reached' : 'Add files'}
              </Button>
            </div>
            ) : null}
          </header>

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
            <div className="flex flex-col gap-5">
                {canManageBot ? (
                <Card className={uploadDocumentsCardClass}>
                  <CardBody className="w-full min-w-0 px-0 py-0 sm:px-0 sm:py-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (atDocumentCapacity) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragEnter={(e) => {
                        if (atDocumentCapacity) return;
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
                        if (atDocumentCapacity) return;
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDocDragOver(false);
                        if (atDocumentCapacity) {
                          appToast.error('Document limit reached', {
                            description: `Each agent can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. Remove one to upload more.`,
                          });
                          return;
                        }
                        const dropped = Array.from(e.dataTransfer.files ?? []).filter((f) => f.size > 0);
                        if (dropped.length > 0) void uploadFilesFromPicker(dropped);
                      }}
                      onClick={() => {
                        if (atDocumentCapacity) {
                          appToast.error('Document limit reached', {
                            description: `Each agent can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. Remove one to upload more.`,
                          });
                          return;
                        }
                        fileInputRef.current?.click();
                      }}
                      className={cn(
                        'flex w-full min-w-0 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-11 text-center outline-none transition-[border-color,background-color] duration-150 sm:px-6 sm:py-12',
                        !atDocumentCapacity && 'group',
                        'focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)]/35 focus-visible:ring-offset-2',
                        atDocumentCapacity
                          ? 'cursor-not-allowed border-slate-200/90 bg-slate-100/80 opacity-75'
                          : 'cursor-pointer border-teal-500/55 bg-teal-50/35',
                        !atDocumentCapacity &&
                          (docDragOver
                            ? 'border-[var(--color-teal-600)] bg-teal-50/90'
                            : 'hover:border-[var(--color-teal-600)] hover:bg-teal-50/80'),
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-full ring-1',
                          atDocumentCapacity
                            ? 'bg-slate-200/80 ring-slate-300/80'
                            : 'bg-teal-50 ring-teal-300/60',
                        )}
                      >
                        <Upload
                          size={22}
                          strokeWidth={1.75}
                          className={cn(
                            'text-teal-600',
                            !atDocumentCapacity &&
                              'transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100',
                          )}
                          aria-hidden
                        />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">Upload documents</p>
                      <p className="mt-1 w-full max-w-none px-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                        .md · .txt · .pdf · .docx · .doc — Max 20 MB per file
                      </p>
                      <p className="mt-2 w-full max-w-none px-1 text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
                        Up to {KNOWLEDGE_DOCUMENTS_MAX} documents per agent. Drag here, click to browse, or multi-select—up
                        to {KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX} files per upload (larger selections split automatically);
                        each batch queues right away.
                      </p>
                    </div>
                  </CardBody>
                </Card>
                ) : null}

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-0 py-0 sm:px-0 sm:py-0">
                    {docListRefreshing && rows.length > 0 ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-2 text-xs text-slate-600 sm:px-5"
                      >
                        <Loader2 size={14} strokeWidth={2} className="shrink-0 animate-spin text-slate-500" aria-hidden />
                        Updating documents…
                      </div>
                    ) : null}
                    <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <FilterCapsule
                            title="Status"
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
                              aria-label="Search status filter options"
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
                                Uses the last successful train time when status is Trained. Rows still queued or training
                                are excluded from this date range filter.
                              </p>
                            </div>
                          </FilterCapsule>
                        </div>

                        <div className="w-full min-w-0 shrink-0 lg:w-80 lg:max-w-md">
                          <Input
                            id="knowledge-doc-search"
                            quiet
                            value={docSearchQuery}
                            onChange={(e) => setDocSearchQuery(e.target.value)}
                            placeholder="Search files by name, type, or pipeline status…"
                            leadingIcon={<Search size={16} strokeWidth={2} className="text-slate-400" aria-hidden />}
                            clearable
                            onClear={() => setDocSearchQuery('')}
                            autoComplete="off"
                            aria-label="Search documents"
                          />
                        </div>
                      </div>
                    </div>

                    {!canManageBot ? null : !docLoading && rows.length > 0 && selectedDocIds.length > 0 ? (
                      <div
                        className={cn(
                          styles.knowledgeSourcesListControlsStack,
                          'border-b border-slate-100 px-4 py-2.5 !mb-0 sm:px-5 sm:py-3',
                        )}
                      >
                        <KnowledgeSourcesBulkBar
                          count={selectedDocIds.length}
                          noun="document"
                          busy={bulkDeleting}
                          onRequestDelete={requestBulkDocDelete}
                          onClear={() => setSelectedDocIds([])}
                        />
                      </div>
                    ) : null}

                    <div className="w-full overflow-x-auto" aria-busy={docLoading || docListRefreshing || undefined}>
                      {docLoading ? (
                        <KnowledgeDocumentsTableSkeleton />
                      ) : docListRefreshing && rows.length === 0 ? (
                        <KnowledgeDocumentsTableSkeleton rows={6} />
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
                        <table className="w-full min-w-[56rem] table-fixed border-collapse text-left text-sm">
                          <colgroup>
                            <col className="w-12" />
                            <col className="min-w-0 w-[40%]" />
                            <col className="w-[9rem]" />
                            <col className="w-[9rem]" />
                            <col className="w-[9rem]" />
                            <col className="w-[7.5rem]" />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                              <th className="w-12 py-2.5 pl-4 pr-2 align-middle sm:pl-5 sm:pr-3">
                                {canManageBot && docBulkSelectablePageIds.length > 0 ? (
                                  <Checkbox
                                    ref={tableSelectAllRef}
                                    checked={docAllOnPageSelected}
                                    onChange={(e) => toggleSelectAllDocsOnPage(e.target.checked)}
                                    aria-label="Select all on this page"
                                  />
                                ) : null}
                              </th>
                              <th className="min-w-0 px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500 sm:px-3">
                                File
                              </th>
                              <th
                                className="px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase leading-snug tracking-wide text-slate-500 sm:px-3"
                                title="Upload, extraction, training, and readiness — aligned with server pipeline stages."
                              >
                                Status
                              </th>
                              <th
                                className="px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase leading-snug tracking-wide text-slate-500 sm:px-3"
                                title="Yes: the assistant can use this file in replies. No: it stays in your library but is not used in answers."
                              >
                                Use in Replies
                              </th>
                              <th
                                className="px-2 py-2.5 text-left text-[0.625rem] font-semibold uppercase leading-snug tracking-wide text-slate-500 sm:px-3"
                                title="When this document last finished training successfully."
                              >
                                Last Trained
                              </th>
                              <th className="py-2.5 pl-2 pr-4 text-right text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500 sm:pl-3 sm:pr-5">
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
                                          No documents match this filter combination. Adjust Status, Use in Replies,
                                          or Last trained above, or use Clear filters below.
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
                              const docRow = row as CustomerWorkspaceDocument;
                              const isDocUploadInProgress = isDocumentRowUploadInProgress(docRow, isPendingRow);
                              const fileLabel = workspaceDocumentPrimaryName(docRow);
                              const ftLabel = fileTypeLabel(row.fileName, row.fileType);
                              const active = row.active !== false;
                              const sizeLabel = formatDocumentCharacterCountSizeLabel(docRow);
                              const lastTrainedIso = documentRowLastTrainedIso(row as DocumentRowWithKbMeta);
                              const lastTrainedCell = formatKbItemLastTrainedRelative(lastTrainedIso);
                              const selected = selectedDocIds.includes(documentId);
                              const patchBusy = patchActiveLoadingId === documentId;
                              const trainingBlocksDelete = isKnowledgeTrainingMutationBlocked(
                                docPollForGate(row as DocumentRowWithKbMeta),
                                row,
                              );
                              const showDocSelectCheckbox =
                                canManageBot &&
                                !isDocUploadInProgress &&
                                (!trainingBlocksDelete || selected);
                              return (
                                <tr
                                  key={documentId || index}
                                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                                >
                                  <td className="py-2.5 pl-4 pr-2 align-middle sm:pl-5 sm:pr-3">
                                    {showDocSelectCheckbox ? (
                                      <Checkbox
                                        checked={selected}
                                        onChange={(e) => toggleDocRowSelected(documentId, e.target.checked)}
                                        aria-label={`Select ${fileLabel}`}
                                      />
                                    ) : null}
                                  </td>
                                  <td className="min-w-0 overflow-hidden px-2 py-2.5 align-middle sm:px-3">
                                    <div className="flex min-w-0 max-w-full items-center gap-2">
                                      <span
                                        className="inline-flex aspect-[40/48] h-6 w-auto max-h-6 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-slate-200/65 shadow-sm"
                                        title={ftLabel}
                                      >
                                        <FileIcon {...fileDocumentFileIconProps(row.fileName, row.fileType)} />
                                        <span className="sr-only">{ftLabel}</span>
                                      </span>
                                      <div className="min-w-0 max-w-full flex-1 overflow-hidden">
                                        {isPendingRow || !documentId ? (
                                          <>
                                            <span
                                              className="block min-w-0 truncate font-normal text-slate-800"
                                              title={fileLabel}
                                            >
                                              {fileLabel}
                                            </span>
                                            <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                                              <DocumentListRowSizeWithTrainingCountdown
                                                doc={docRow}
                                                sizeLabel={sizeLabel}
                                                runAfter={(row as DocumentRowWithKbMeta).runAfter ?? null}
                                                trainingCanon={baselineDocumentRowTrainingStatus(docRow)}
                                              />
                                            </span>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            className="block w-full min-w-0 max-w-full overflow-hidden border-0 bg-transparent p-0 text-left"
                                            onClick={() => {
                                              void navigate(`${kbBase}/documents/${encodeURIComponent(documentId)}`);
                                            }}
                                          >
                                            <span
                                              className="block min-w-0 truncate font-normal text-slate-800 underline decoration-slate-300 decoration-1 underline-offset-2 hover:text-teal-700 hover:decoration-teal-600"
                                              title={fileLabel}
                                            >
                                              {fileLabel}
                                            </span>
                                            <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                                              <DocumentListRowSizeWithTrainingCountdown
                                                doc={docRow}
                                                sizeLabel={sizeLabel}
                                                runAfter={(row as DocumentRowWithKbMeta).runAfter ?? null}
                                                trainingCanon={baselineDocumentRowTrainingStatus(docRow)}
                                              />
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="min-w-0 px-2 py-2.5 align-middle sm:px-3">
                                    <DocumentKbTrainingStatusTag
                                      doc={docRow}
                                      label={formatDocumentTrainingStatusDisplayLabel(docRow, documentDisplayOpts)}
                                      documentDisplayOpts={documentDisplayOpts}
                                      className="max-w-full"
                                    />
                                  </td>
                                  <td className="px-2 py-2.5 align-middle sm:px-3">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      {canManageBot ? (
                                      <Switch
                                        checked={active}
                                        disabled={patchBusy || isDocUploadInProgress}
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
                                      ) : (
                                        <span className="text-xs font-medium text-slate-600">{active ? 'Yes' : 'No'}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="min-w-0 px-2 py-2.5 align-middle sm:px-3">
                                    <span
                                      className={cn(
                                        'block truncate text-xs tabular-nums sm:whitespace-normal sm:text-sm',
                                        lastTrainedIso ? 'text-slate-600' : 'text-slate-400',
                                      )}
                                      title={lastTrainedIso ? lastTrainedIso : undefined}
                                    >
                                      {isDocUploadInProgress ? '-' : lastTrainedCell}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap py-2.5 pl-2 pr-4 align-middle text-right sm:pl-3 sm:pr-5">
                                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                      {isDocUploadInProgress ? (
                                        <span
                                          className="inline-flex items-center justify-end pr-1 text-slate-500"
                                          title="Uploading"
                                        >
                                          <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
                                          <span className="sr-only">Uploading</span>
                                        </span>
                                      ) : (
                                        <div className="inline-flex flex-wrap items-center justify-end gap-0.5">
                                          {canManageBot && canShowDocumentRowDelete(docRow, isPendingRow) ? (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-slate-500 hover:text-[var(--color-danger-text-emphasis)]"
                                              onClick={() => {
                                                if (
                                                  blockIfTrainingForItem(
                                                    docPollForGate(row as DocumentRowWithKbMeta),
                                                    row as DocumentRowWithKbMeta,
                                                  )
                                                ) {
                                                  return;
                                                }
                                                setDocDeleteLoading(false);
                                                setDocDeleteTarget({ id: documentId, label: fileLabel });
                                              }}
                                              aria-label="Delete document"
                                              title="Delete"
                                            >
                                              <Trash2 size={16} aria-hidden />
                                            </Button>
                                          ) : null}
                                        </div>
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

                    {!docLoading && rows.length > 0 ? (
                      <KnowledgeSourcesPagination
                        page={docPage}
                        pageCount={docTotalPages}
                        totalFiltered={docFilteredRows.length}
                        pageSize={docPerPage}
                        perPageSelectId={docPerPageSelectId}
                        onPageSizeChange={(s) => {
                          setDocPerPage(clampKnowledgeSourcesPageSize(s));
                          setDocPage(1);
                        }}
                        onPageChange={setDocPage}
                        barClassName="px-4 pb-3 sm:px-5 sm:pb-4"
                      />
                    ) : null}
                  </CardBody>
                </Card>
              </div>
          </div>
        </div>
      </div>


      <Modal
        open={bulkDeleteConfirmOpen}
        allowDismiss={!bulkDeleting}
        onClose={closeBulkDeleteConfirmModal}
        title={bulkDeleteServerCount === 0 ? 'Clear selection?' : 'Delete selected documents?'}
        tone="danger"
        description={
          bulkDeleteServerCount === 0 ? (
            <span className="font-medium text-slate-800">
              Selected rows are still uploading. Nothing can be removed from the server yet—only your selection will be
              cleared.
            </span>
          ) : bulkDeletePendingCount === 0 ? (
            <span className="font-medium text-slate-800">
              {bulkDeleteServerCount === 1
                ? 'One file will stop being used for answers right away.'
                : `${bulkDeleteServerCount} files will stop being used for answers right away.`}
            </span>
          ) : (
            <span className="font-medium text-slate-800">
              {bulkDeleteServerCount === 1
                ? 'One file will be removed from this assistant’s knowledge base.'
                : `${bulkDeleteServerCount} files will be removed from this assistant’s knowledge base.`}{' '}
              {bulkDeletePendingCount === 1
                ? 'One selected upload is still in progress and is not deleted from the server yet.'
                : `${bulkDeletePendingCount} selected uploads are still in progress and are not deleted from the server yet.`}
            </span>
          )
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              disabled={bulkDeleting}
              onClick={closeBulkDeleteConfirmModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className={styles.knowledgeModalActionDanger}
              disabled={bulkDeleting}
              aria-busy={bulkDeleting || undefined}
              onClick={() => void bulkDeleteSelectedDocs()}
            >
              {bulkDeleting ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                  Deleting…
                </>
              ) : bulkDeleteServerCount === 0 ? (
                'Clear selection'
              ) : bulkDeleteServerCount === 1 ? (
                'Delete document'
              ) : (
                `Delete ${bulkDeleteServerCount} documents`
              )}
            </Button>
          </>
        }
      >
        <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
          {bulkDeleteServerCount === 0
            ? 'You can select files again after uploads finish if you want to remove them.'
            : 'This removes the files from this assistant’s knowledge base. Upload them again if you change your mind.'}
        </p>
      </Modal>

      <Modal
        open={docDeleteTarget != null}
        allowDismiss={!docDeleteLoading}
        onClose={() => {
          if (docDeleteLoading) return;
          closeDocDeleteModal();
        }}
        title="Delete document?"
        tone="danger"
        description={
          docDeleteTarget ? (
            <span className="font-medium text-slate-800">
              &ldquo;{previewText(docDeleteTarget.label, 100)}&rdquo; — it will stop being used for answers right away.
            </span>
          ) : (
            'The file will stop being used for answers right away.'
          )
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              disabled={docDeleteLoading}
              onClick={closeDocDeleteModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className={styles.knowledgeModalActionDanger}
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
      {trainingGateModal}
    </div>
  );
}

export function KnowledgeDocumentsPage() {
  const { botId } = useBotWorkspace();
  return <KnowledgeBaseSection key={botId ?? 'no-bot'} />;
}

export function KnowledgeSection() {
  const { botId } = useBotWorkspace();
  return <KnowledgeBaseSection key={botId ?? 'no-bot'} />;
}
