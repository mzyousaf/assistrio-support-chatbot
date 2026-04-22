import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { getCustomerApiOrigin } from '../../api/client';
import {
  patchCustomerBot,
  postCustomerBotRotateAccessKey,
  postCustomerBotRotateSecretKey,
} from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';
import { normalizeCustomerEmbedOrigin, widgetSnippet } from '../../lib/embedOrigin';
import { useBotWorkspace } from './BotWorkspaceContext';
import { MAX_ALLOWED_ORIGINS } from './publishConstants';

export type PublishStatus = 'draft' | 'published';
export type EmbedVisibility = 'public' | 'private';
export type EmbedInstallMode = 'chat-widget' | 'iframe';

export type OriginRow = {
  clientId: string;
  origin: string;
  label: string;
  isActive: boolean;
};

function newRow(): OriginRow {
  return {
    clientId:
      typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `origin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    origin: '',
    label: '',
    isActive: true,
  };
}

function rowsFromBot(bot: CustomerBotDetail): OriginRow[] {
  const ao = bot.allowedOrigins;
  if (!Array.isArray(ao) || ao.length === 0) return [];
  return ao.map((x) => ({
    clientId:
      typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `origin-${String(x.origin)}-${Math.random().toString(36).slice(2)}`,
    origin: String(x.origin ?? ''),
    label: typeof x.label === 'string' ? x.label : '',
    isActive: x.isActive !== false,
  }));
}

function buildEmbedSnippet(
  botId: string,
  accessKey: string,
  visibility: EmbedVisibility,
  secretKey: string,
): string {
  const asset =
    (import.meta.env.VITE_WIDGET_ASSET_ORIGIN ?? '').replace(/\/$/, '') || 'https://widget.assistrio.com';
  return widgetSnippet({
    botId,
    apiBaseUrl: getCustomerApiOrigin(),
    accessKey,
    visibility,
    ...(visibility === 'private' && secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
    widgetAssetOrigin: asset,
  });
}

function buildIframePlaceholderSnippet(installOrigin: string): string {
  const originNote = installOrigin.trim() || 'https://your-allowed-origin.com';
  return [
    `<!-- Assistrio iframe embed (limited features — chat widget recommended for full capabilities) -->`,
    `<!-- Page origin must match an allowed origin: ${originNote} -->`,
    `<iframe`,
    `  title="Assistrio chat"`,
    `  src="about:blank"`,
    `  width="400"`,
    `  height="640"`,
    `  style="border:0;border-radius:12px;max-width:100%;"`,
    `  loading="lazy"`,
    `/>`,
  ].join('\n');
}

type PublishWorkspaceContextValue = {
  bot: CustomerBotDetail;
  botId: string;
  reload: () => Promise<void>;
  status: PublishStatus;
  setStatus: (v: PublishStatus) => void;
  visibility: EmbedVisibility;
  setVisibility: (v: EmbedVisibility) => void;
  rows: OriginRow[];
  embedInstallMode: EmbedInstallMode;
  setEmbedInstallMode: (v: EmbedInstallMode) => void;
  selectedInstallOrigin: string;
  setSelectedInstallOrigin: (v: string) => void;
  secretRevealed: boolean;
  setSecretRevealed: Dispatch<SetStateAction<boolean>>;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  markDirty: () => void;
  copiedId: string | null;
  markCopied: (id: string) => void;
  copyText: (text: string, id: string) => Promise<void>;
  updateRow: (index: number, patch: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) => void;
  addRow: (initial?: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) => void;
  removeRow: (index: number) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  accessKeyDisplay: string;
  secretKeyDisplay: string;
  /** Chat widget script (Assistrio JS embed). */
  chatWidgetSnippet: string;
  /** Shown in Widget setup: script or iframe sample based on embed mode. */
  installSnippet: string;
  iframeSnippetText: string;
  activeValidOriginsForSelect: string[];
  nameOk: boolean;
  descOk: boolean;
  activeValidOriginCount: number;
  canPublishBackend: boolean;
  rotatingAccessKey: boolean;
  rotatingSecretKey: boolean;
  keyActionError: string | null;
  rotateAccessKey: () => Promise<void>;
  rotateSecretKey: () => Promise<void>;
};

const PublishWorkspaceContext = createContext<PublishWorkspaceContextValue | null>(null);

export function PublishWorkspaceProvider({ children }: { children: ReactNode }) {
  const { bot, botId, softReload } = useBotWorkspace();

  const [status, setStatusInternal] = useState<PublishStatus>('draft');
  const [visibility, setVisibilityState] = useState<EmbedVisibility>('public');
  const [rows, setRows] = useState<OriginRow[]>([]);
  const [embedInstallMode, setEmbedInstallModeState] = useState<EmbedInstallMode>('chat-widget');

  /** Iframe embed is disabled in the UI; keep mode on chat-widget if state ever holds iframe. */
  useEffect(() => {
    setEmbedInstallModeState((m) => (m === 'iframe' ? 'chat-widget' : m));
  }, []);
  const [selectedInstallOrigin, setSelectedInstallOriginState] = useState('');
  const [secretRevealed, setSecretRevealed] = useState(false);

  /** Draft/publish + visibility + embed UI (not per–allowed-origin row edits; those save immediately). */
  const [metaDirty, setMetaDirty] = useState(false);
  const metaDirtyRef = useRef(false);
  metaDirtyRef.current = metaDirty;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rotatingAccessKey, setRotatingAccessKey] = useState(false);
  const [rotatingSecretKey, setRotatingSecretKey] = useState(false);
  const [keyActionError, setKeyActionError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const markCopied = useCallback((id: string) => {
    setCopiedId(id);
    if (copyT.current) clearTimeout(copyT.current);
    copyT.current = setTimeout(() => setCopiedId(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copyT.current) clearTimeout(copyT.current);
    };
  }, []);

  const copyText = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        markCopied(id);
      } catch {
        /* ignore */
      }
    },
    [markCopied],
  );

  useEffect(() => {
    if (!bot) return;
    if (metaDirtyRef.current) {
      setSaveError(null);
      setKeyActionError(null);
      return;
    }
    setStatusInternal(bot.status === 'published' ? 'published' : 'draft');
    setVisibilityState(bot.visibility === 'private' ? 'private' : 'public');
    const nextRows = rowsFromBot(bot);
    setRows(nextRows);
    const valid = nextRows
      .filter((r) => r.isActive && normalizeCustomerEmbedOrigin(r.origin))
      .map((r) => normalizeCustomerEmbedOrigin(r.origin)!);
    setSelectedInstallOriginState((prev) => (prev && valid.includes(prev) ? prev : valid[0] ?? ''));
    setSecretRevealed(false);
    setSaveError(null);
    setKeyActionError(null);
  }, [bot]);

  const statusRef = useRef(status);
  statusRef.current = status;

  const setStatus = useCallback((v: PublishStatus) => {
    setStatusInternal(v);
    setMetaDirty(true);
    setSaveError(null);
  }, []);

  const markDirty = useCallback(() => {
    setMetaDirty(true);
    setSaveError(null);
  }, []);

  const nameOk = Boolean(String(bot?.name ?? '').trim());
  const descOk = Boolean(String(bot?.description ?? '').trim());
  const activeValidOriginCount = useMemo(
    () => rows.filter((r) => r.isActive && normalizeCustomerEmbedOrigin(r.origin)).length,
    [rows],
  );
  const canPublishBackend = nameOk && descOk && activeValidOriginCount >= 1;

  const activeValidOriginsForSelect = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.isActive) continue;
      const o = normalizeCustomerEmbedOrigin(r.origin);
      if (o && !seen.has(o)) {
        seen.add(o);
        out.push(o);
      }
    }
    return out;
  }, [rows]);

  useEffect(() => {
    if (activeValidOriginsForSelect.length === 0) return;
    setSelectedInstallOriginState((prev) =>
      prev && activeValidOriginsForSelect.includes(prev) ? prev : activeValidOriginsForSelect[0],
    );
  }, [activeValidOriginsForSelect]);

  const accessKeyDisplay = String(bot?.accessKey ?? '').trim();
  const secretKeyDisplay = String(bot?.secretKey ?? '').trim();

  const chatWidgetSnippet = useMemo(() => {
    if (!botId) return '';
    return buildEmbedSnippet(botId, accessKeyDisplay, visibility, secretKeyDisplay);
  }, [botId, accessKeyDisplay, visibility, secretKeyDisplay]);

  const iframeSnippetText = useMemo(() => {
    const origin = selectedInstallOrigin.trim() || activeValidOriginsForSelect[0] || '';
    return buildIframePlaceholderSnippet(origin);
  }, [selectedInstallOrigin, activeValidOriginsForSelect]);

  const installSnippet = embedInstallMode === 'chat-widget' ? chatWidgetSnippet : iframeSnippetText;

  const persistOriginsSnapshot = useCallback(
    async (nextRows: OriginRow[]) => {
      if (!bot || !botId || saving) return;
      if (nextRows.length > MAX_ALLOWED_ORIGINS) {
        setSaveError(`You can add up to ${MAX_ALLOWED_ORIGINS} websites.`);
        return;
      }
      for (let i = 0; i < nextRows.length; i++) {
        const r = nextRows[i];
        const t = r.origin.trim();
        if (!t) continue;
        if (!normalizeCustomerEmbedOrigin(t)) {
          setSaveError(
            'Each website must be a full URL with https:// (production domains only—localhost cannot be saved).',
          );
          return;
        }
      }
      const st = statusRef.current;
      const activeValidOriginCountSnap = nextRows.filter(
        (r) => r.isActive && normalizeCustomerEmbedOrigin(r.origin),
      ).length;
      const canPublishSnap = nameOk && descOk && activeValidOriginCountSnap >= 1;
      if (st === 'published' && !canPublishSnap) {
        setSaveError(
          'To publish, add an agent name and profile description in Profile, and at least one active allowed website below.',
        );
        return;
      }
      const allowedOrigins = nextRows
        .map((r) => {
          const origin = normalizeCustomerEmbedOrigin(r.origin.trim());
          if (!origin) return null;
          const label = r.label.trim();
          return {
            origin,
            ...(label ? { label } : {}),
            isActive: r.isActive,
          };
        })
        .filter((x): x is { origin: string; label?: string; isActive: boolean } => x != null);
      if (st === 'published' && !allowedOrigins.some((o) => o.isActive)) {
        setSaveError('Published requires at least one active allowed website.');
        return;
      }
      setSaving(true);
      setSaveError(null);
      /** Origins-only PATCH: avoids duplicating the debounced deploy save (status/visibility + origins). */
      const res = await patchCustomerBot(botId, {
        allowedOrigins,
      });
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      void softReload();
    },
    [bot, botId, descOk, nameOk, saving, softReload],
  );

  function updateRow(index: number, patch: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      next[index] = { ...cur, ...patch };
      void persistOriginsSnapshot(next);
      return next;
    });
  }

  function addRow(initial?: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) {
    setRows((prev) => {
      if (prev.length >= MAX_ALLOWED_ORIGINS) return prev;
      const next = [...prev, { ...newRow(), ...initial }];
      void persistOriginsSnapshot(next);
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      void persistOriginsSnapshot(next);
      return next;
    });
  }

  const saveDeploymentSettings = useCallback(async () => {
    if (!bot || !botId || saving) return;

    if (rows.length > MAX_ALLOWED_ORIGINS) {
      setSaveError(`You can add up to ${MAX_ALLOWED_ORIGINS} websites.`);
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const t = r.origin.trim();
      if (!t) continue;
      if (!normalizeCustomerEmbedOrigin(t)) {
        setSaveError(
          'Each website must be a full URL with https:// (production domains only—localhost cannot be saved).',
        );
        return;
      }
    }

    if (status === 'published' && !canPublishBackend) {
      setSaveError(
        'To publish, add an agent name and profile description in Profile, and at least one active allowed website below.',
      );
      return;
    }

    const allowedOrigins = rows
      .map((r) => {
        const origin = normalizeCustomerEmbedOrigin(r.origin.trim());
        if (!origin) return null;
        const label = r.label.trim();
        return {
          origin,
          ...(label ? { label } : {}),
          isActive: r.isActive,
        };
      })
      .filter((x): x is { origin: string; label?: string; isActive: boolean } => x != null);

    if (status === 'published' && !allowedOrigins.some((o) => o.isActive)) {
      setSaveError('Published requires at least one active allowed website.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const res = await patchCustomerBot(botId, {
      status,
      visibility,
      allowedOrigins,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setMetaDirty(false);
    await softReload();
  }, [bot, botId, saving, rows, status, visibility, canPublishBackend, softReload]);

  const onSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!metaDirty || saving || saveError) return;
    const id = window.setTimeout(() => {
      void saveDeploymentSettings();
    }, 650);
    return () => window.clearTimeout(id);
  }, [metaDirty, saving, saveError, saveDeploymentSettings]);

  const rotateAccessKey = useCallback(async () => {
    if (!botId || rotatingAccessKey) return;
    setKeyActionError(null);
    setRotatingAccessKey(true);
    const res = await postCustomerBotRotateAccessKey(botId);
    setRotatingAccessKey(false);
    if (!res.ok) {
      setKeyActionError(res.error);
      return;
    }
    await softReload();
  }, [botId, rotatingAccessKey, softReload]);

  const rotateSecretKey = useCallback(async () => {
    if (!botId || rotatingSecretKey) return;
    setKeyActionError(null);
    setRotatingSecretKey(true);
    const res = await postCustomerBotRotateSecretKey(botId);
    setRotatingSecretKey(false);
    if (!res.ok) {
      setKeyActionError(res.error);
      return;
    }
    await softReload();
  }, [botId, rotatingSecretKey, softReload]);

  const value = useMemo<PublishWorkspaceContextValue>(
    () => ({
      bot: bot!,
      botId: botId!,
      reload: softReload,
      status,
      setStatus,
      visibility,
      setVisibility: (v: EmbedVisibility) => {
        setVisibilityState(v);
        markDirty();
      },
      rows,
      embedInstallMode,
      setEmbedInstallMode: (v: EmbedInstallMode) => {
        if (v === 'iframe') return;
        setEmbedInstallModeState(v);
        markDirty();
      },
      selectedInstallOrigin,
      setSelectedInstallOrigin: (v: string) => {
        setSelectedInstallOriginState(v);
        markDirty();
      },
      secretRevealed,
      setSecretRevealed,
      dirty: metaDirty,
      saving,
      saveError,
      markDirty,
      copiedId,
      markCopied,
      copyText,
      updateRow,
      addRow,
      removeRow,
      onSubmit,
      accessKeyDisplay,
      secretKeyDisplay,
      chatWidgetSnippet,
      installSnippet,
      iframeSnippetText,
      activeValidOriginsForSelect,
      nameOk,
      descOk,
      activeValidOriginCount,
      canPublishBackend,
      rotatingAccessKey,
      rotatingSecretKey,
      keyActionError,
      rotateAccessKey,
      rotateSecretKey,
    }),
    [
      bot,
      botId,
      softReload,
      status,
      setStatus,
      visibility,
      rows,
      embedInstallMode,
      selectedInstallOrigin,
      secretRevealed,
      metaDirty,
      saving,
      saveError,
      markDirty,
      copiedId,
      markCopied,
      copyText,
      accessKeyDisplay,
      secretKeyDisplay,
      chatWidgetSnippet,
      installSnippet,
      iframeSnippetText,
      activeValidOriginsForSelect,
      nameOk,
      descOk,
      activeValidOriginCount,
      canPublishBackend,
      rotatingAccessKey,
      rotatingSecretKey,
      keyActionError,
      rotateAccessKey,
      rotateSecretKey,
    ],
  );

  if (!bot || !botId) return null;

  return <PublishWorkspaceContext.Provider value={value}>{children}</PublishWorkspaceContext.Provider>;
}

export function usePublishWorkspace(): PublishWorkspaceContextValue {
  const ctx = useContext(PublishWorkspaceContext);
  if (!ctx) {
    throw new Error('usePublishWorkspace must be used within PublishWorkspaceProvider');
  }
  return ctx;
}
