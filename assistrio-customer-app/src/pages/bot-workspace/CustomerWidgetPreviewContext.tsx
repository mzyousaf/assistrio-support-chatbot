import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { EmbedChatConfig } from '@assistrio/chat-widget';
import {
  buildCustomerWidgetPreviewOverridesFromBot,
  mergeAiIntegrationsDraftIntoPreviewOverrides,
  mergeAppearanceChatUiIntoPreviewOverrides,
  mergeBehaviorDraftIntoPreviewOverrides,
  mergeChatsDraftIntoPreviewOverrides,
  mergeLeadCaptureDraftIntoPreviewOverrides,
  mergeProfileDraftIntoPreviewOverrides,
  type AiIntegrationsPreviewDraftSlice,
  type BehaviorPreviewDraftSlice,
  type ChatsPreviewDraftSlice,
  type CustomerPreviewOverrides,
  type LeadCapturePreviewDraft,
  type ProfilePreviewDraftSlice,
} from '@/lib/buildCustomerWidgetPreviewOverrides';
import { useBotWorkspace } from './BotWorkspaceContext';

export type PreviewSurfaceRegistration = {
  /** Unique per preview pane instance (e.g. `WidgetPreviewContainer` `previewMountId`). */
  id: string;
  element: HTMLElement;
  /**
   * Higher wins when multiple surfaces are registered (e.g. floating drawer vs inline).
   * Default 0.
   */
  priority?: number;
};

type RegistryEntry = {
  element: HTMLElement;
  priority: number;
  seq: number;
};

type CustomerWidgetPreviewContextValue = {
  /** Bump whenever registry or overrides change so hosts recompute. */
  previewEpoch: number;
  registerSurface: (reg: PreviewSurfaceRegistration) => () => void;
  /** Active portal target, or null if none qualify (host uses off-screen fallback). */
  getActiveSurfaceElement: () => HTMLElement | null;
  /**
   * Set by `ChatWidgetPreview` from `useWidgetPreviewShell`: true when the right-lane (or
   * open drawer) inline preview is visible. When false, the host should use floating presentation.
   */
  inlineSlotWantsContained: boolean;
  setInlineSlotWantsContained: (next: boolean) => void;
  /** Unsaved behavior-tab slice; cleared when leaving behavior page. */
  setBehaviorDraftSlice: (next: BehaviorPreviewDraftSlice | null) => void;
  /**
   * Live `chatUi` map from Widget Appearance or Chat Experience while that editor is mounted.
   * Set `null` on section unmount.
   */
  setAppearanceChatUiDraft: (next: Record<string, unknown> | null) => void;
  /** Live Profile editor snapshot while that section is mounted; merged into preview bot fields. */
  setProfileDraftSlice: (next: ProfilePreviewDraftSlice | null) => void;
  /** Live Capture Leads form payload while that section is mounted. */
  setLeadCaptureDraftSlice: (next: LeadCapturePreviewDraft | null) => void;
  /** Live AI & Advanced unsaved `personality` + `config` (+ optional composer toggles) while that section is mounted. */
  setAiIntegrationsDraftSlice: (next: AiIntegrationsPreviewDraftSlice | null) => void;
  /** Live Chat Experience “Chats” tab (visitor multi-conversation) while that section is mounted. */
  setChatsDraftSlice: (next: ChatsPreviewDraftSlice | null) => void;
  /** Merged overrides for `EmbedWidgetRoot` (baseline + section drafts: behavior, AI, leads, chat UI, profile). */
  previewOverrides: CustomerPreviewOverrides | null;
  /**
   * Contained widget inline “Expand chat” state (driven by `EmbedChatConfig.onContainedPanelExpandChange` from the
   * portaled `EmbedWidgetRoot`). Used for preview portal `max-height` (collapsed vs expanded caps).
   */
  containedPanelExpanded: boolean;
  setContainedPanelExpanded: (next: boolean) => void;
};

const CustomerWidgetPreviewContext = createContext<CustomerWidgetPreviewContextValue | null>(null);

/** Reject disconnected targets or self/ancestors with `display:none` / `visibility:hidden`. Do not use layout size: empty inline preview mounts are 0×0 until the portal paints. */
function isSurfaceUnusableForPortal(element: HTMLElement): boolean {
  if (!element.isConnected) return true;
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return false;
  let el: HTMLElement | null = element;
  while (el) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return true;
    el = el.parentElement;
  }
  return false;
}

function pickActiveSurfaceElement(registrations: Map<string, RegistryEntry>): HTMLElement | null {
  let best: { el: HTMLElement; priority: number; seq: number } | null = null;
  for (const { element, priority, seq } of registrations.values()) {
    if (isSurfaceUnusableForPortal(element)) continue;
    if (
      !best ||
      priority > best.priority ||
      (priority === best.priority && seq > best.seq)
    ) {
      best = { el: element, priority, seq };
    }
  }
  return best?.el ?? null;
}

export function CustomerWidgetPreviewProvider({ children }: { children: ReactNode }) {
  const { bot, loadState } = useBotWorkspace();
  const registrationsRef = useRef(new Map<string, RegistryEntry>());
  const seqRef = useRef(0);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [behaviorDraft, setBehaviorDraftSlice] = useState<BehaviorPreviewDraftSlice | null>(null);
  const [appearanceChatUiDraft, setAppearanceChatUiDraft] = useState<Record<string, unknown> | null>(null);
  const [profileDraft, setProfileDraftSlice] = useState<ProfilePreviewDraftSlice | null>(null);
  const [leadCaptureDraft, setLeadCaptureDraftSlice] = useState<LeadCapturePreviewDraft | null>(null);
  const [aiIntegrationsDraft, setAiIntegrationsDraftSlice] = useState<AiIntegrationsPreviewDraftSlice | null>(null);
  const [chatsDraft, setChatsDraftSlice] = useState<ChatsPreviewDraftSlice | null>(null);
  const [inlineSlotWantsContained, setInlineSlotWantsContained] = useState(false);
  const [containedPanelExpanded, setContainedPanelExpanded] = useState(false);

  const bump = useCallback(() => {
    setPreviewEpoch((n) => n + 1);
  }, []);

  const registerSurface = useCallback((reg: PreviewSurfaceRegistration) => {
    const { id, element, priority = 0 } = reg;
    if (!(element instanceof HTMLElement) || !id.trim()) {
      return () => {};
    }
    const seq = ++seqRef.current;
    registrationsRef.current.set(id, { element, priority, seq });
    bump();
    return () => {
      const cur = registrationsRef.current.get(id);
      if (cur && cur.element === element) {
        registrationsRef.current.delete(id);
        bump();
      }
    };
  }, [bump]);

  const getActiveSurfaceElement = useCallback((): HTMLElement | null => {
    return pickActiveSurfaceElement(registrationsRef.current);
  }, [previewEpoch]);

  const baselineOverrides = useMemo((): CustomerPreviewOverrides | null => {
    if (loadState !== 'ok' || !bot) return null;
    return buildCustomerWidgetPreviewOverridesFromBot(bot);
  }, [bot, loadState]);

  const previewOverrides = useMemo((): CustomerPreviewOverrides | null => {
    if (!baselineOverrides) return null;
    const withBehavior = mergeBehaviorDraftIntoPreviewOverrides(baselineOverrides, behaviorDraft);
    const withAi = mergeAiIntegrationsDraftIntoPreviewOverrides(withBehavior, aiIntegrationsDraft);
    const withLeads = mergeLeadCaptureDraftIntoPreviewOverrides(withAi, leadCaptureDraft);
    const withAppearance = mergeAppearanceChatUiIntoPreviewOverrides(withLeads, appearanceChatUiDraft);
    const withChats = mergeChatsDraftIntoPreviewOverrides(withAppearance, chatsDraft);
    return mergeProfileDraftIntoPreviewOverrides(withChats, profileDraft);
  }, [baselineOverrides, behaviorDraft, aiIntegrationsDraft, leadCaptureDraft, appearanceChatUiDraft, chatsDraft, profileDraft]);

  const value = useMemo(
    (): CustomerWidgetPreviewContextValue => ({
      previewEpoch,
      registerSurface,
      getActiveSurfaceElement,
      inlineSlotWantsContained,
      setInlineSlotWantsContained,
      setBehaviorDraftSlice,
      setAppearanceChatUiDraft,
      setProfileDraftSlice,
      setLeadCaptureDraftSlice,
      setAiIntegrationsDraftSlice,
      setChatsDraftSlice,
      previewOverrides,
      containedPanelExpanded,
      setContainedPanelExpanded,
    }),
    [
      previewEpoch,
      registerSurface,
      getActiveSurfaceElement,
      inlineSlotWantsContained,
      setInlineSlotWantsContained,
      setBehaviorDraftSlice,
      setAppearanceChatUiDraft,
      setProfileDraftSlice,
      setLeadCaptureDraftSlice,
      setAiIntegrationsDraftSlice,
      setChatsDraftSlice,
      previewOverrides,
      containedPanelExpanded,
      setContainedPanelExpanded,
    ],
  );

  return (
    <CustomerWidgetPreviewContext.Provider value={value}>{children}</CustomerWidgetPreviewContext.Provider>
  );
}

export function useCustomerWidgetPreview(): CustomerWidgetPreviewContextValue {
  const ctx = useContext(CustomerWidgetPreviewContext);
  if (!ctx) {
    throw new Error('useCustomerWidgetPreview must be used within CustomerWidgetPreviewProvider');
  }
  return ctx;
}

export function toEmbedPreviewOverrides(
  o: CustomerPreviewOverrides | null,
): EmbedChatConfig['previewOverrides'] | undefined {
  if (!o) return undefined;
  return o as EmbedChatConfig['previewOverrides'];
}
