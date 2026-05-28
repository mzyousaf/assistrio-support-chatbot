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
import {
  getCustomerAppPublicOrigin,
  iframeEmbedSnippet,
  normalizeCustomerEmbedOrigin,
  widgetSnippet,
} from '../../lib/embedOrigin';
import {
  toastPlaygroundAccessKeyRotateFailed,
  toastPlaygroundAccessKeyRotated,
  toastPlaygroundAgentAutoDraftedNoOrigins,
  toastPlaygroundAgentMovedToDraft,
  toastPlaygroundAgentWentLive,
  toastPlaygroundDeployOriginsSaveFailed,
  toastPlaygroundDeployOriginsSaved,
  toastPlaygroundSecretKeyRotateFailed,
  toastPlaygroundSecretKeyRotated,
  toastPlaygroundSectionSaveFailed,
  toastPlaygroundSectionSaved,
  toastPlaygroundValidationWarning,
} from '@/lib/playgroundSectionSaveToasts';
import { useBotWorkspace } from './BotWorkspaceContext';
import type { InstallSnippetUpdateNotice } from './installSnippetUpdateNotice';
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

function patchResultStatus(data: unknown): PublishStatus | null {
  if (!data || typeof data !== 'object') return null;
  const status = (data as { status?: unknown }).status;
  return status === 'published' || status === 'draft' ? status : null;
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

type PublishWorkspaceContextValue = {
  bot: CustomerBotDetail;
  botId: string;
  reload: () => Promise<void>;
  status: PublishStatus;
  setStatus: (v: PublishStatus) => void;
  /** Apply publish/draft from lifecycle API without marking deploy meta dirty. */
  syncLifecycleStatus: (v: PublishStatus) => void;
  visibility: EmbedVisibility;
  setVisibility: (v: EmbedVisibility) => void;
  visibilitySavingTarget: EmbedVisibility | null;
  rows: OriginRow[];
  embedInstallMode: EmbedInstallMode;
  setEmbedInstallMode: (v: EmbedInstallMode) => void;
  selectedInstallOrigin: string;
  setSelectedInstallOrigin: (v: string) => void;
  secretRevealed: boolean;
  setSecretRevealed: Dispatch<SetStateAction<boolean>>;
  accessRevealed: boolean;
  setAccessRevealed: Dispatch<SetStateAction<boolean>>;
  dirty: boolean;
  saving: boolean;
  savingOrigins: boolean;
  savingDeploymentMeta: boolean;
  saveError: string | null;
  markDirty: () => void;
  copiedId: string | null;
  markCopied: (id: string) => void;
  copyText: (text: string, id: string) => Promise<void>;
  updateRow: (
    index: number,
    patch: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>,
  ) => Promise<boolean>;
  addRow: (initial?: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) => Promise<boolean>;
  removeRow: (index: number) => Promise<boolean>;
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
  snippetUpdateNotice: InstallSnippetUpdateNotice | null;
  dismissSnippetUpdateNotice: () => void;
};

const PublishWorkspaceContext = createContext<PublishWorkspaceContextValue | null>(null);

export function PublishWorkspaceProvider({ children }: { children: ReactNode }) {
  const { bot, botId, softReload, patchBot } = useBotWorkspace();

  const [status, setStatusInternal] = useState<PublishStatus>('draft');
  const [visibility, setVisibilityState] = useState<EmbedVisibility>('public');
  const [visibilitySavingTarget, setVisibilitySavingTarget] = useState<EmbedVisibility | null>(null);
  const visibilitySavingTargetRef = useRef<EmbedVisibility | null>(null);
  visibilitySavingTargetRef.current = visibilitySavingTarget;
  const [rows, setRows] = useState<OriginRow[]>([]);
  const [embedInstallMode, setEmbedInstallModeState] = useState<EmbedInstallMode>('chat-widget');
  const [selectedInstallOrigin, setSelectedInstallOriginState] = useState('');
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [accessRevealed, setAccessRevealed] = useState(false);

  /** Draft/publish + visibility + embed UI (not per–allowed-origin row edits; those save immediately). */
  const [metaDirty, setMetaDirty] = useState(false);
  const metaDirtyRef = useRef(false);
  metaDirtyRef.current = metaDirty;
  const [savingOrigins, setSavingOrigins] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [deploymentMetaSavePending, setDeploymentMetaSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rotatingAccessKey, setRotatingAccessKey] = useState(false);
  const [rotatingSecretKey, setRotatingSecretKey] = useState(false);
  const [keyActionError, setKeyActionError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [snippetUpdateNotice, setSnippetUpdateNotice] = useState<InstallSnippetUpdateNotice | null>(null);
  const copyT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismissSnippetUpdateNotice = useCallback(() => {
    setSnippetUpdateNotice(null);
  }, []);

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
    if (metaDirtyRef.current || visibilitySavingTargetRef.current) {
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
    setAccessRevealed(false);
    setSaveError(null);
    setKeyActionError(null);
  }, [bot]);

  const statusRef = useRef(status);
  statusRef.current = status;
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;

  const setStatus = useCallback((v: PublishStatus) => {
    setStatusInternal(v);
    setMetaDirty(true);
    setSaveError(null);
  }, []);

  const syncLifecycleStatus = useCallback((v: PublishStatus) => {
    setStatusInternal(v);
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
      appOrigin: getCustomerAppPublicOrigin(),
      botId,
      accessKey: accessKeyDisplay,
      ...(visibility === 'private' && secretKeyDisplay.trim()
        ? { secretKey: secretKeyDisplay.trim() }
        : {}),
    });
  }, [botId, accessKeyDisplay, visibility, secretKeyDisplay]);

  const installSnippet = embedInstallMode === 'chat-widget' ? chatWidgetSnippet : iframeSnippetText;

  const saving = savingOrigins || savingMeta;
  const savingDeploymentMeta = deploymentMetaSavePending || savingMeta;

  const persistOriginsSnapshot = useCallback(
    async (nextRows: OriginRow[]): Promise<boolean> => {
      if (!bot || !botId || savingOrigins || savingMeta) return false;
      if (nextRows.length > MAX_ALLOWED_ORIGINS) {
        setSaveError(`You can add up to ${MAX_ALLOWED_ORIGINS} websites.`);
        toastPlaygroundValidationWarning(
          'Too many allowed websites',
          `Remove entries until you have at most ${MAX_ALLOWED_ORIGINS} sites.`,
        );
        return false;
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
          return false;
        }
      }
      const st = statusRef.current;
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
      setSavingOrigins(true);
      setSaveError(null);
      /** Origins-only PATCH: avoids duplicating the debounced deploy save (status/visibility + origins). */
      const res = await patchCustomerBot(botId, {
        allowedOrigins,
      });
      setSavingOrigins(false);
      if (!res.ok) {
        setSaveError(res.error);
        toastPlaygroundDeployOriginsSaveFailed(res.error);
        return false;
      }
      const nextStatus = patchResultStatus(res.data);
      if (st === 'published' && nextStatus === 'draft') {
        setStatusInternal('draft');
        setMetaDirty(false);
        setDeploymentMetaSavePending(false);
        toastPlaygroundAgentAutoDraftedNoOrigins();
      } else {
        toastPlaygroundDeployOriginsSaved();
      }
      setRows(nextRows);
      void softReload();
      return true;
    },
    [bot, botId, savingOrigins, savingMeta, softReload],
  );

  const applyOriginsChange = useCallback(
    (buildNext: (prev: OriginRow[]) => OriginRow[] | null): Promise<boolean> =>
      new Promise((resolve) => {
        setRows((prev) => {
          const next = buildNext(prev);
          if (!next) {
            resolve(false);
            return prev;
          }
          void persistOriginsSnapshot(next).then(resolve);
          return prev;
        });
      }),
    [persistOriginsSnapshot],
  );

  const updateRow = useCallback(
    (index: number, patch: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) =>
      applyOriginsChange((prev) => {
        const cur = prev[index];
        if (!cur) return null;
        const next = [...prev];
        next[index] = { ...cur, ...patch };
        return next;
      }),
    [applyOriginsChange],
  );

  const addRow = useCallback(
    (initial?: Partial<Pick<OriginRow, 'origin' | 'label' | 'isActive'>>) =>
      applyOriginsChange((prev) => {
        if (prev.length >= MAX_ALLOWED_ORIGINS) return null;
        return [...prev, { ...newRow(), ...initial }];
      }),
    [applyOriginsChange],
  );

  const removeRow = useCallback(
    (index: number) => applyOriginsChange((prev) => prev.filter((_, i) => i !== index)),
    [applyOriginsChange],
  );

  const saveVisibility = useCallback(
    async (nextVisibility: EmbedVisibility) => {
      if (!bot || !botId || savingMeta || savingOrigins || visibilitySavingTarget) return;
      if (nextVisibility === visibility) return;

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

      setVisibilitySavingTarget(nextVisibility);
      setSaveError(null);

      const res = await patchCustomerBot(botId, {
        status,
        visibility: nextVisibility,
        allowedOrigins,
      });

      setVisibilitySavingTarget(null);
      if (!res.ok) {
        setSaveError(res.error);
        toastPlaygroundSectionSaveFailed('deploy', res.error);
        return;
      }

      setVisibilityState(nextVisibility);
      patchBot({ visibility: nextVisibility });
      toastPlaygroundSectionSaved('deploy');
      if (visibility === 'public' && nextVisibility === 'private') {
        setSnippetUpdateNotice({ reason: 'visibility', visibility: nextVisibility });
      }
      void softReload();
    },
    [bot, botId, savingMeta, savingOrigins, visibilitySavingTarget, visibility, rows, status, softReload, patchBot],
  );

  const saveDeploymentSettings = useCallback(async () => {
    if (!bot || !botId || savingMeta || savingOrigins) return;

    if (rows.length > MAX_ALLOWED_ORIGINS) {
      setSaveError(`You can add up to ${MAX_ALLOWED_ORIGINS} websites.`);
      toastPlaygroundValidationWarning(
        'Too many allowed websites',
        `Remove entries until you have at most ${MAX_ALLOWED_ORIGINS} sites.`,
      );
      setDeploymentMetaSavePending(false);
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
        setDeploymentMetaSavePending(false);
        return;
      }
    }

    if (status === 'published' && !canPublishBackend) {
      const wasLive = bot.status === 'published';
      const onlyClearingOrigins = wasLive && activeValidOriginCount === 0 && nameOk && descOk;
      if (!onlyClearingOrigins) {
        const msg =
          'To publish, add an agent name and profile description in Profile, and at least one active allowed website below.';
        setSaveError(msg);
        toastPlaygroundValidationWarning(
          'Publish requirements not met',
          'Complete Profile (name and description) and add at least one active allowed website.',
        );
        setDeploymentMetaSavePending(false);
        return;
      }
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

    if (status === 'published' && !allowedOrigins.some((o) => o.isActive) && bot.status !== 'published') {
      setSaveError('Published requires at least one active allowed website.');
      toastPlaygroundValidationWarning(
        'Active website required',
        'Add at least one active allowed website before going live.',
      );
      setDeploymentMetaSavePending(false);
      return;
    }

    setSavingMeta(true);
    setSaveError(null);

    const res = await patchCustomerBot(botId, {
      status,
      visibility,
      allowedOrigins,
    });
    setSavingMeta(false);
    setDeploymentMetaSavePending(false);
    if (!res.ok) {
      setSaveError(res.error);
      toastPlaygroundSectionSaveFailed('deploy', res.error);
      return;
    }
    const wasPublished = bot.status === 'published';
    const nextStatus = patchResultStatus(res.data);
    if (nextStatus === 'published' && !wasPublished && status === 'published') {
      toastPlaygroundAgentWentLive();
    } else if (nextStatus === 'draft' && wasPublished) {
      setStatusInternal('draft');
      if (status === 'draft') {
        toastPlaygroundAgentMovedToDraft();
      } else {
        toastPlaygroundAgentAutoDraftedNoOrigins();
      }
    } else {
      toastPlaygroundSectionSaved('deploy');
    }
    setMetaDirty(false);
    await softReload();
  }, [bot, botId, savingMeta, savingOrigins, rows, status, visibility, canPublishBackend, softReload, nameOk, descOk, activeValidOriginCount]);

  const onSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!metaDirty || savingMeta || savingOrigins || saveError) return;
    const id = window.setTimeout(() => {
      void saveDeploymentSettings();
    }, 650);
    return () => window.clearTimeout(id);
  }, [metaDirty, savingMeta, savingOrigins, saveError, saveDeploymentSettings]);

  const rotateAccessKey = useCallback(async () => {
    if (!botId || rotatingAccessKey) return;
    setKeyActionError(null);
    setRotatingAccessKey(true);
    const res = await postCustomerBotRotateAccessKey(botId);
    setRotatingAccessKey(false);
    if (!res.ok) {
      setKeyActionError(res.error);
      toastPlaygroundAccessKeyRotateFailed(res.error);
      return;
    }
    toastPlaygroundAccessKeyRotated();
    patchBot({ accessKey: res.data.accessKey });
    setSnippetUpdateNotice({ reason: 'accessKey', visibility: visibilityRef.current });
    void softReload();
  }, [botId, rotatingAccessKey, softReload, patchBot]);

  const rotateSecretKey = useCallback(async () => {
    if (!botId || rotatingSecretKey) return;
    setKeyActionError(null);
    setRotatingSecretKey(true);
    const res = await postCustomerBotRotateSecretKey(botId);
    setRotatingSecretKey(false);
    if (!res.ok) {
      setKeyActionError(res.error);
      toastPlaygroundSecretKeyRotateFailed(res.error);
      return;
    }
    toastPlaygroundSecretKeyRotated();
    patchBot({ secretKey: res.data.secretKey });
    setSnippetUpdateNotice({ reason: 'secretKey', visibility: visibilityRef.current });
    void softReload();
  }, [botId, rotatingSecretKey, softReload, patchBot]);

  const value = useMemo<PublishWorkspaceContextValue>(
    () => ({
      bot: bot!,
      botId: botId!,
      reload: softReload,
      status,
      setStatus,
      syncLifecycleStatus,
      visibility,
      setVisibility: (v: EmbedVisibility) => {
        void saveVisibility(v);
      },
      visibilitySavingTarget,
      rows,
      embedInstallMode,
      setEmbedInstallMode: (v: EmbedInstallMode) => {
        setEmbedInstallModeState(v);
      },
      selectedInstallOrigin,
      setSelectedInstallOrigin: (v: string) => {
        setSelectedInstallOriginState(v);
        markDirty();
      },
      secretRevealed,
      setSecretRevealed,
      accessRevealed,
      setAccessRevealed,
      dirty: metaDirty,
      saving,
      savingOrigins,
      savingDeploymentMeta,
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
      snippetUpdateNotice,
      dismissSnippetUpdateNotice,
    }),
    [
      bot,
      botId,
      softReload,
      status,
      setStatus,
      syncLifecycleStatus,
      visibility,
      visibilitySavingTarget,
      rows,
      embedInstallMode,
      selectedInstallOrigin,
      secretRevealed,
      accessRevealed,
      metaDirty,
      saving,
      savingOrigins,
      savingDeploymentMeta,
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
      snippetUpdateNotice,
      dismissSnippetUpdateNotice,
      saveVisibility,
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
