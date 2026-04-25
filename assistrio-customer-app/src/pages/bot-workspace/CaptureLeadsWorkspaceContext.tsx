import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { patchCustomerBot } from '../../api/customerApi';
import { uniqueLeadFieldKey } from '@/lib/leadFieldKey';
import { LEAD_FIELDS_MAX } from './behaviorConstants';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import type { LeadCapturePreviewDraft } from '@/lib/buildCustomerWidgetPreviewOverrides';

export type LeadFieldDraft = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'url';
  required: boolean;
  disabled?: boolean;
  /** Preserved from API when present; workspace UI does not edit aliases. */
  aliases?: string[];
};

function normalizeLeadFromBot(raw: unknown): {
  enabled: boolean;
  fields: LeadFieldDraft[];
  askStrategy: 'soft' | 'balanced' | 'direct';
  captureMode: 'chat' | 'form' | 'hybrid';
  politeMode: boolean;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: false,
      fields: [],
      askStrategy: 'balanced',
      captureMode: 'hybrid',
      politeMode: true,
    };
  }
  const o = raw as Record<string, unknown>;
  const fieldsRaw = Array.isArray(o.fields) ? o.fields : [];
  const fields: LeadFieldDraft[] = fieldsRaw
    .map((f) => {
      if (!f || typeof f !== 'object') return null;
      const x = f as Record<string, unknown>;
      const type = String(x.type ?? 'text');
      const t =
        type === 'email' || type === 'phone' || type === 'number' || type === 'url' ? type : 'text';
      const aliases = Array.isArray(x.aliases)
        ? (x.aliases as unknown[]).map((a) => String(a).trim().toLowerCase()).filter(Boolean)
        : [];
      const base: LeadFieldDraft = {
        key: String(x.key ?? '').trim() || 'field',
        label: String(x.label ?? '').trim() || 'Field',
        type: t,
        required: x.required !== false,
        disabled: x.disabled === true,
      };
      return aliases.length ? { ...base, aliases } : base;
    })
    .filter((x): x is LeadFieldDraft => x != null)
    .slice(0, LEAD_FIELDS_MAX);

  const ask = String(o.askStrategy ?? '');
  const askStrategy =
    ask === 'soft' || ask === 'balanced' || ask === 'direct' ? ask : 'balanced';
  const cap = String(o.captureMode ?? '');
  const captureMode =
    cap === 'chat' || cap === 'form' || cap === 'hybrid' ? cap : 'hybrid';
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : fields.length > 0;

  return {
    enabled,
    fields,
    askStrategy,
    captureMode,
    politeMode: o.politeMode !== false,
  };
}

const DEFAULT_LEAD_FIELDS: LeadFieldDraft[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
];

/** Core widget fields; cannot be removed; label/type identity are enforced in the UI. */
export const BUILTIN_LEAD_FIELD_KEYS = new Set(['name', 'email', 'company', 'phone']);

function isBuiltinLeadKey(key: string) {
  return BUILTIN_LEAD_FIELD_KEYS.has(key.trim().toLowerCase());
}

type CaptureLeadsWorkspaceValue = {
  leadEnabled: boolean;
  setLeadEnabled: (v: boolean) => void;
  leadFields: LeadFieldDraft[];
  leadAskStrategy: 'soft' | 'balanced' | 'direct';
  setLeadAskStrategy: (v: 'soft' | 'balanced' | 'direct') => void;
  leadCaptureMode: 'chat' | 'form' | 'hybrid';
  leadPoliteMode: boolean;
  setLeadPoliteMode: (v: boolean) => void;
  appendLeadField: (input: {
    label: string;
    type: LeadFieldDraft['type'];
    required: boolean;
    disabled?: boolean;
  }) => void;
  updateLeadField: (index: number, patch: Partial<LeadFieldDraft>) => void;
  removeLeadField: (index: number) => void;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  save: () => Promise<void>;
};

const CaptureLeadsWorkspaceContext = createContext<CaptureLeadsWorkspaceValue | null>(null);

const LEAD_CAPTURE_PREVIEW_DEBOUNCE_MS = 150;

export function CaptureLeadsWorkspaceProvider({ children }: { children: ReactNode }) {
  const { bot, botId, softReload } = useBotWorkspace();
  const { setLeadCaptureDraftSlice } = useCustomerWidgetPreview();

  const [leadEnabled, setLeadEnabled] = useState(false);
  const [leadFields, setLeadFields] = useState<LeadFieldDraft[]>([]);
  const [leadAskStrategy, setLeadAskStrategy] = useState<'soft' | 'balanced' | 'direct'>('balanced');
  const [leadCaptureMode, setLeadCaptureMode] = useState<'chat' | 'form' | 'hybrid'>('hybrid');
  const [leadPoliteMode, setLeadPoliteMode] = useState(true);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateFromBot = useCallback(() => {
    if (!bot) return;
    const lc = normalizeLeadFromBot(bot.leadCapture);
    setLeadEnabled(lc.enabled);
    setLeadFields(lc.fields.length ? lc.fields : []);
    setLeadAskStrategy(lc.askStrategy);
    setLeadCaptureMode(lc.captureMode);
    setLeadPoliteMode(lc.politeMode);
    setDirty(false);
    setSaveError(null);
  }, [bot]);

  /** Avoid resetting lead fields while the user has unsaved edits (e.g. after background bot refetch). */
  useEffect(() => {
    if (dirty) return;
    hydrateFromBot();
  }, [hydrateFromBot, dirty]);

  useEffect(() => {
    return registerManualSaveGuard('capture-leads', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const payload: LeadCapturePreviewDraft = {
        enabled: leadEnabled,
        fields: leadFields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required !== false,
          ...(f.disabled ? { disabled: true } : {}),
          ...(Array.isArray(f.aliases) && f.aliases.length ? { aliases: f.aliases } : {}),
        })),
        askStrategy: leadAskStrategy,
        captureMode: leadCaptureMode,
        politeMode: leadPoliteMode,
      };
      setLeadCaptureDraftSlice(payload);
    }, LEAD_CAPTURE_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    leadEnabled,
    leadFields,
    leadAskStrategy,
    leadCaptureMode,
    leadPoliteMode,
    setLeadCaptureDraftSlice,
  ]);

  useEffect(() => {
    return () => setLeadCaptureDraftSlice(null);
  }, [setLeadCaptureDraftSlice]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const appendLeadField = useCallback(
    (input: {
      label: string;
      type: LeadFieldDraft['type'];
      required: boolean;
      disabled?: boolean;
    }) => {
      setLeadFields((prev) => {
        if (prev.length >= LEAD_FIELDS_MAX) return prev;
        const label = input.label.trim() || 'Field';
        const key = uniqueLeadFieldKey(label, prev.map((f) => f.key));
        return [
          ...prev,
          {
            key,
            label,
            type: input.type,
            required: input.required,
            ...(input.disabled ? { disabled: true } : {}),
          },
        ];
      });
      markDirty();
    },
    [markDirty],
  );

  const updateLeadField = useCallback(
    (index: number, patch: Partial<LeadFieldDraft>) => {
      setLeadFields((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;
        const builtin = isBuiltinLeadKey(cur.key);
        const k = cur.key.trim().toLowerCase();
        let effective: Partial<LeadFieldDraft> = patch;
        if (builtin) {
          const { label: _l, type: _t, key: _k, ...rest } = patch;
          effective = { ...rest };
          if (k === 'name') {
            const { required: _r, ...nameRest } = effective;
            effective = nameRest;
          }
        }
        const merged = { ...cur, ...effective };
        if (!builtin && patch.label != null) {
          merged.key = uniqueLeadFieldKey(merged.label, next.map((f) => f.key), cur.key);
        }
        next[index] = merged;
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const removeLeadField = useCallback(
    (index: number) => {
      setLeadFields((prev) => {
        const cur = prev[index];
        if (cur && isBuiltinLeadKey(cur.key)) return prev;
        return prev.filter((_, i) => i !== index);
      });
      markDirty();
    },
    [markDirty],
  );

  const setLeadEnabledWrapped = useCallback(
    (v: boolean) => {
      setLeadEnabled(v);
      if (v) {
        setLeadFields((prev) =>
          prev.length === 0 ? DEFAULT_LEAD_FIELDS.map((x) => ({ ...x })) : prev,
        );
      }
      markDirty();
    },
    [markDirty],
  );

  const save = useCallback(async () => {
    if (!bot || !botId || saving) return;

    const activeLeadFields = leadFields.filter((f) => !f.disabled);
    if (leadEnabled && activeLeadFields.length === 0) {
      setSaveError('Add at least one active field, or turn off lead capture.');
      return;
    }

    const leadPayload = {
      enabled: leadEnabled,
      fields: leadFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required !== false,
        ...(f.disabled ? { disabled: true } : {}),
        ...(Array.isArray(f.aliases) && f.aliases.length ? { aliases: f.aliases } : {}),
      })),
      askStrategy: leadAskStrategy,
      captureMode: leadCaptureMode,
      politeMode: leadPoliteMode,
    };

    setSaving(true);
    setSaveError(null);

    const res = await patchCustomerBot(botId, { leadCapture: leadPayload });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setDirty(false);
    await softReload();
  }, [
    bot,
    botId,
    softReload,
    leadEnabled,
    leadFields,
    leadAskStrategy,
    leadCaptureMode,
    leadPoliteMode,
    saving,
  ]);

  const value = useMemo<CaptureLeadsWorkspaceValue>(
    () => ({
      leadEnabled,
      setLeadEnabled: setLeadEnabledWrapped,
      leadFields,
      leadAskStrategy,
      setLeadAskStrategy: (v) => {
        setLeadAskStrategy(v);
        markDirty();
      },
      leadCaptureMode,
      leadPoliteMode,
      setLeadPoliteMode: (v) => {
        setLeadPoliteMode(v);
        markDirty();
      },
      appendLeadField,
      updateLeadField,
      removeLeadField,
      dirty,
      saving,
      saveError,
      save,
    }),
    [
      leadEnabled,
      setLeadEnabledWrapped,
      leadFields,
      leadAskStrategy,
      leadCaptureMode,
      leadPoliteMode,
      appendLeadField,
      updateLeadField,
      removeLeadField,
      dirty,
      saving,
      saveError,
      save,
      markDirty,
    ],
  );

  return (
    <CaptureLeadsWorkspaceContext.Provider value={value}>{children}</CaptureLeadsWorkspaceContext.Provider>
  );
}

export function useCaptureLeadsWorkspace(): CaptureLeadsWorkspaceValue {
  const ctx = useContext(CaptureLeadsWorkspaceContext);
  if (!ctx) throw new Error('useCaptureLeadsWorkspace must be used within CaptureLeadsWorkspaceProvider');
  return ctx;
}
