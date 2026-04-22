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
  mergeAppearanceChatUiIntoPreviewOverrides,
  mergeBehaviorDraftIntoPreviewOverrides,
  mergeProfileDraftIntoPreviewOverrides,
  type BehaviorPreviewDraftSlice,
  type CustomerPreviewOverrides,
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
  /** Unsaved behavior-tab slice; cleared when leaving behavior page. */
  setBehaviorDraftSlice: (next: BehaviorPreviewDraftSlice | null) => void;
  /**
   * Live Widget Appearance `chatUi` map while that editor is mounted; merged into preview `chatUI`.
   * Set `null` on section unmount.
   */
  setAppearanceChatUiDraft: (next: Record<string, unknown> | null) => void;
  /** Live Profile editor snapshot while that section is mounted; merged into preview bot fields. */
  setProfileDraftSlice: (next: ProfilePreviewDraftSlice | null) => void;
  /** Merged overrides for `EmbedWidgetRoot` (baseline bot + behavior + appearance + profile drafts). */
  previewOverrides: CustomerPreviewOverrides | null;
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
    const withAppearance = mergeAppearanceChatUiIntoPreviewOverrides(withBehavior, appearanceChatUiDraft);
    return mergeProfileDraftIntoPreviewOverrides(withAppearance, profileDraft);
  }, [baselineOverrides, behaviorDraft, appearanceChatUiDraft, profileDraft]);

  const value = useMemo(
    (): CustomerWidgetPreviewContextValue => ({
      previewEpoch,
      registerSurface,
      getActiveSurfaceElement,
      setBehaviorDraftSlice,
      setAppearanceChatUiDraft,
      setProfileDraftSlice,
      previewOverrides,
    }),
    [
      previewEpoch,
      registerSurface,
      getActiveSurfaceElement,
      setBehaviorDraftSlice,
      setAppearanceChatUiDraft,
      setProfileDraftSlice,
      previewOverrides,
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
