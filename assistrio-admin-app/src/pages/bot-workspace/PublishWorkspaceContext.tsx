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
import { getAdminApiOrigin } from '@/api/client';
import {
  patchAdminBot,
  postAdminBotRotateAccessKey,
  postAdminBotRotateSecretKey,
} from '@/api/adminApi';
import type { AdminBotWorkspaceBot } from '@/api/types';
import {
  getAdminAppPublicOrigin,
  iframeEmbedSnippet,
  normalizeCustomerEmbedOrigin,
  widgetSnippet,
} from '@/lib/embedOrigin';
import {
  toastPlaygroundAccessKeyRotateFailed,
  toastPlaygroundAccessKeyRotated,
  toastPlaygroundDeployOriginsSaveFailed,
  toastPlaygroundSecretKeyRotateFailed,
  toastPlaygroundSecretKeyRotated,
  toastPlaygroundSectionSaveFailed,
  toastPlaygroundSectionSaved,
  toastPlaygroundValidationWarning,
} from '@/lib/playgroundSectionSaveToasts';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
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

function rowsFromBot(bot: AdminBotWorkspaceBot): OriginRow[] {
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
    apiBaseUrl: getAdminApiOrigin(),
    accessKey,
    visibility,
    ...(visibility === 'private' && secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
    widgetAssetOrigin: asset,
  });
}

type PublishWorkspaceContextValue = {
  bot: AdminBotWorkspaceBot;
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
  const { bot, botId, softReload } = useAdminBotWorkspace();

  const [status, setStatusInternal] = useState<PublishStatus>('draft');
  const [visibility, setVisibilityState] = useState<EmbedVisibility>('public');
  const [rows, setRows] = useState<OriginRow[]>([]);
  const [embedInstallMode, setEmbedInstallModeState] = useState<EmbedInstallMode>('chat-widget');
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
    if (!botId) return '';
    return iframeEmbedSnippet({
      appOrigin: getAdminAppPublicOrigin(),
      botId,
      accessKey: accessKeyDisplay,
      ...(visibility === 'private' && secretKeyDisplay.trim()
        ? { secretKey: secretKeyDisplay.trim() }
        : {}),
    });
  }, [botId, accessKeyDisplay, visibility, secretKeyDisplay]);

  const installSnippet = embedInstallMode === 'chat-widget' ? chatWidgetSnippet : iframeSnippetText;

  const persistOriginsSnapshot = useCallback(
    async (nextRows: OriginRow[]) => {
      if (!bot || !botId || saving) return;
      if (nextRows.length > MAX_ALLOWED_ORIGINS) {
        setSaveError(`You can add up to ${MAX_ALLOWED_ORIGINS} websites.`);
        toastPlaygroundValidationWarning(
          'Too many allowed websites',
          `Remove entries until you have at most ${MAX_ALLOWED_ORIGINS} sites.`,
        );
        return;
      }
      for (let i = 0; i < nextRows.length; i++) {
        const r = nextRows[i];
        const t = r.origin.trim();
        if (!t) continue;
        if (!normalizeCustomerEmbedOrigin(t)) {
          const msg =
            'Each website must be a full URL with https:// (production domains only—localhost cannot be saved).';
          setSaveError(msg);
          toastPlaygroundValidationWarning(
            'Website URL not valid',
            'Use a production https:// URL for each allowed site. Localhost cannot be saved.',
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
        const msg =
          'To publish, add an bot name and profile description in Profile, and at least one active allowed website below.';
        setSaveError(msg);
        toastPlaygroundValidationWarning(
          'Publish requirements not met',
          'Complete Profile (name and description) and add at least one active allowed website.',
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
        toastPlaygroundValidationWarning(
          'Active website required',
          'Turn on at least one allowed website while your bot is published.',
        );
        return;
      }
      setSaving(true);
      setSaveError(null);
      /** Origins-only PATCH: avoids duplicating the debounced deploy save (status/visibility + origins). */
      const res = await patchAdminBot(botId, {
        allowedOrigins,
      });
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        toastPlaygroundDeployOriginsSaveFailed(res.error);
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
      toastPlaygroundValidationWarning(
        'Too many allowed websites',
        `Remove entries until you have at most ${MAX_ALLOWED_ORIGINS} sites.`,
      );
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const t = r.origin.trim();
      if (!t) continue;
      if (!normalizeCustomerEmbedOrigin(t)) {
        const msg =
          'Each website must be a full URL with https:// (production domains only—localhost cannot be saved).';
        setSaveError(msg);
        toastPlaygroundValidationWarning(
          'Website URL not valid',
          'Use a production https:// URL for each allowed site. Localhost cannot be saved.',
        );
        return;
      }
    }

    if (status === 'published' && !canPublishBackend) {
      const msg =
        'To publish, add an bot name and profile description in Profile, and at least one active allowed website below.';
      setSaveError(msg);
      toastPlaygroundValidationWarning(
        'Publish requirements not met',
        'Complete Profile (name and description) and add at least one active allowed website.',
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
      toastPlaygroundValidationWarning(
        'Active website required',
        'Turn on at least one allowed website while your bot is published.',
      );
      return;
    }

    setSaving(true);
    setSaveError(null);

    const res = await patchAdminBot(botId, {
      status,
      visibility,
      allowedOrigins,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      toastPlaygroundSectionSaveFailed('deploy', res.error);
      return;
    }
    toastPlaygroundSectionSaved('deploy');
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
    const res = await postAdminBotRotateAccessKey(botId);
    setRotatingAccessKey(false);
    if (!res.ok) {
      setKeyActionError(res.error);
      toastPlaygroundAccessKeyRotateFailed(res.error);
      return;
    }
    toastPlaygroundAccessKeyRotated();
    await softReload();
  }, [botId, rotatingAccessKey, softReload]);

  const rotateSecretKey = useCallback(async () => {
    if (!botId || rotatingSecretKey) return;
    setKeyActionError(null);
    setRotatingSecretKey(true);
    const res = await postAdminBotRotateSecretKey(botId);
    setRotatingSecretKey(false);
    if (!res.ok) {
      setKeyActionError(res.error);
      toastPlaygroundSecretKeyRotateFailed(res.error);
      return;
    }
    toastPlaygroundSecretKeyRotated();
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
