import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { patchCustomerBot } from '../../api/customerApi';
import {
  BEHAVIOR_PRESETS,
  behaviorPresetToPrompt,
  CUSTOM_CATEGORY_PILL,
  EXAMPLE_QUESTIONS_MAX,
  EXAMPLE_QUESTION_MAX_CHARS,
  MAX_CATEGORY_PILLS,
  parseCategoriesFromBot,
  VALID_TONE_VALUES,
} from './behaviorConstants';
import { useBotWorkspace } from './BotWorkspaceContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';

export type BehaviorSubnav = 'personality' | 'first-message';

type BehaviorWorkspaceValue = {
  activeSubnav: BehaviorSubnav;
  setActiveSubnav: (v: BehaviorSubnav) => void;
  /** Predefined category values only (when not in custom mode). */
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  customCategoryMode: boolean;
  setCustomCategoryMode: (v: boolean) => void;
  customCategoryText: string;
  setCustomCategoryText: (v: string) => void;
  toggleCategoryPill: (value: string) => void;
  behaviorPreset: string;
  setBehaviorPreset: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  personalityDescription: string;
  setPersonalityDescription: (v: string) => void;
  thingsToAvoid: string;
  setThingsToAvoid: (v: string) => void;
  welcomeMessage: string;
  setWelcomeMessage: (v: string) => void;
  welcomeMessageEnabled: boolean;
  setWelcomeMessageEnabled: (v: boolean) => void;
  exampleQuestions: string[];
  setExampleQuestions: (v: string[]) => void;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  save: () => Promise<void>;
  /** Reset local editor state from the current `bot` snapshot (e.g. after discard). */
  hydrateFromBot: () => void;
};

const BehaviorWorkspaceContext = createContext<BehaviorWorkspaceValue | null>(null);

export function BehaviorWorkspaceProvider({ children }: { children: ReactNode }) {
  const { bot, botId, softReload } = useBotWorkspace();
  const { setBehaviorDraftSlice } = useCustomerWidgetPreview();

  const [activeSubnav, setActiveSubnav] = useState<BehaviorSubnav>('personality');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['support']);
  const [customCategoryMode, setCustomCategoryMode] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [behaviorPreset, setBehaviorPreset] = useState('default');
  const [tone, setTone] = useState('friendly');
  const [personalityDescription, setPersonalityDescription] = useState('');
  const [thingsToAvoid, setThingsToAvoid] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const welcomeStashRef = useRef('');
  const [welcomeMessageEnabled, setWelcomeMessageEnabledState] = useState(false);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateFromBot = useCallback(() => {
    if (!bot) return;
    const cats = Array.isArray(bot.categories)
      ? bot.categories.map((c) => String(c))
      : bot.category
        ? [String(bot.category)]
        : [];
    const parsed = parseCategoriesFromBot(cats);
    setSelectedCategories(parsed.selectedPredefined);
    setCustomCategoryMode(parsed.customMode);
    setCustomCategoryText(parsed.customText);

    const p = bot.personality;
    const pr = String(p?.behaviorPreset ?? 'default');
    setBehaviorPreset(BEHAVIOR_PRESETS.some((x) => x.value === pr) ? pr : 'default');
    const t = String(p?.tone ?? 'friendly');
    setTone(VALID_TONE_VALUES.has(t) ? t : 'friendly');
    setPersonalityDescription(typeof p?.description === 'string' ? p.description : '');
    setThingsToAvoid(typeof p?.thingsToAvoid === 'string' ? p.thingsToAvoid : '');

    const wm = typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage : '';
    setWelcomeMessage(wm);
    welcomeStashRef.current = wm;
    setWelcomeMessageEnabledState(wm.trim().length > 0);
    setExampleQuestions(
      Array.isArray(bot.exampleQuestions)
        ? bot.exampleQuestions
            .map((q) => String(q).trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS))
            .filter(Boolean)
            .slice(0, EXAMPLE_QUESTIONS_MAX)
        : [],
    );

    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrateFromBot();
  }, [hydrateFromBot]);

  useEffect(() => {
    return registerManualSaveGuard('behavior', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  const BEHAVIOR_PREVIEW_DEBOUNCE_MS = 300;

  useEffect(() => {
    const combinedSystemPrompt =
      `${behaviorPresetToPrompt(behaviorPreset)}\n\n` +
      (personalityDescription.trim()
        ? `Additional behavior:\n${personalityDescription.trim()}`
        : '');
    const personalityPatch: Record<string, unknown> = {
      behaviorPreset,
      description: personalityDescription.trim() || undefined,
      thingsToAvoid: thingsToAvoid.trim() || undefined,
      tone,
      systemPrompt: combinedSystemPrompt.trim() || undefined,
    };
    const suggested = exampleQuestions
      .map((q) => String(q).trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS))
      .filter(Boolean)
      .slice(0, EXAMPLE_QUESTIONS_MAX);

    const t = window.setTimeout(() => {
      setBehaviorDraftSlice({
        welcomeMessage: welcomeMessageEnabled ? welcomeMessage.trim() || undefined : undefined,
        suggestedQuestions: suggested,
        personalityPatch,
      });
    }, BEHAVIOR_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    behaviorPreset,
    exampleQuestions,
    personalityDescription,
    setBehaviorDraftSlice,
    thingsToAvoid,
    tone,
    welcomeMessage,
    welcomeMessageEnabled,
  ]);

  useEffect(() => {
    return () => setBehaviorDraftSlice(null);
  }, [setBehaviorDraftSlice]);

  useEffect(() => {
    if (welcomeMessageEnabled) welcomeStashRef.current = welcomeMessage;
  }, [welcomeMessage, welcomeMessageEnabled]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const setCustomCategoryModeWrapped = useCallback(
    (v: boolean) => {
      setCustomCategoryMode(v);
      if (v) setSelectedCategories([]);
      markDirty();
    },
    [markDirty],
  );

  const setSelectedCategoriesWrapped = useCallback(
    (next: string[]) => {
      setCustomCategoryMode(false);
      setCustomCategoryText('');
      setSelectedCategories(next);
      markDirty();
    },
    [markDirty],
  );

  const toggleCategoryPill = useCallback(
    (value: string) => {
      if (value === CUSTOM_CATEGORY_PILL) {
        setCustomCategoryMode(true);
        setSelectedCategories([]);
        markDirty();
        return;
      }
      setCustomCategoryMode(false);
      setCustomCategoryText('');
      setSelectedCategories((prev) => {
        const has = prev.includes(value);
        if (has) {
          const next = prev.filter((x) => x !== value);
          return next.length > 0 ? next : ['support'];
        }
        if (prev.length >= MAX_CATEGORY_PILLS) return prev;
        return [...prev, value];
      });
      markDirty();
    },
    [markDirty],
  );

  const setCustomCategoryTextWrapped = useCallback(
    (v: string) => {
      setCustomCategoryText(v);
      markDirty();
    },
    [markDirty],
  );

  const save = useCallback(async () => {
    if (!bot || !botId || saving) return;
    const desc = personalityDescription.trim();
    if (!desc) {
      setSaveError('Instructions are required to define how your agent behaves.');
      setActiveSubnav('personality');
      return;
    }

    let categoriesPayload: string[] = [];
    if (customCategoryMode) {
      const c = customCategoryText.trim().toLowerCase();
      if (!c) {
        setSaveError('Enter a custom category, or switch back to predefined categories.');
        setActiveSubnav('personality');
        return;
      }
      categoriesPayload = [c];
    } else {
      if (selectedCategories.length === 0) {
        setSaveError('Select at least one category.');
        setActiveSubnav('personality');
        return;
      }
      if (selectedCategories.length > MAX_CATEGORY_PILLS) {
        setSaveError(`Select at most ${MAX_CATEGORY_PILLS} categories.`);
        setActiveSubnav('personality');
        return;
      }
      categoriesPayload = [...selectedCategories];
    }

    const combinedSystemPrompt =
      `${behaviorPresetToPrompt(behaviorPreset)}\n\n` + (desc ? `Additional behavior:\n${desc}` : '');

    const raw = bot.personality ?? {};
    /** Mirrors backend `normalizePersonalityInput` — only known fields are persisted. Preserve optional name/language. */
    const personalityPayload: Record<string, unknown> = {
      behaviorPreset,
      tone,
      description: desc,
      systemPrompt: combinedSystemPrompt.trim(),
    };
    const nameTrimmed = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (nameTrimmed) personalityPayload.name = nameTrimmed;
    const langTrimmed = typeof raw.language === 'string' ? raw.language.trim() : '';
    if (langTrimmed) personalityPayload.language = langTrimmed;
    const tta = thingsToAvoid.trim();
    if (tta) personalityPayload.thingsToAvoid = tta;

    const exampleTrimmed = exampleQuestions
      .map((q) => q.trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS))
      .filter(Boolean)
      .slice(0, EXAMPLE_QUESTIONS_MAX);

    setSaving(true);
    setSaveError(null);

    const welcomeStored = welcomeMessageEnabled && welcomeMessage.trim() ? welcomeMessage.trim() : '';
    const res = await patchCustomerBot(botId, {
      categories: categoriesPayload,
      welcomeMessage: welcomeStored,
      exampleQuestions: exampleTrimmed,
      personality: personalityPayload,
    });
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
    personalityDescription,
    customCategoryMode,
    customCategoryText,
    selectedCategories,
    behaviorPreset,
    tone,
    thingsToAvoid,
    welcomeMessage,
    welcomeMessageEnabled,
    exampleQuestions,
    saving,
  ]);

  const value = useMemo<BehaviorWorkspaceValue>(
    () => ({
      activeSubnav,
      setActiveSubnav,
      selectedCategories,
      setSelectedCategories: setSelectedCategoriesWrapped,
      customCategoryMode,
      setCustomCategoryMode: setCustomCategoryModeWrapped,
      customCategoryText,
      setCustomCategoryText: setCustomCategoryTextWrapped,
      toggleCategoryPill,
      behaviorPreset,
      setBehaviorPreset: (v) => {
        setBehaviorPreset(v);
        markDirty();
      },
      tone,
      setTone: (v) => {
        setTone(v);
        markDirty();
      },
      personalityDescription,
      setPersonalityDescription: (v) => {
        setPersonalityDescription(v);
        markDirty();
      },
      thingsToAvoid,
      setThingsToAvoid: (v) => {
        setThingsToAvoid(v);
        markDirty();
      },
      welcomeMessage,
      setWelcomeMessage: (v) => {
        setWelcomeMessage(v);
        markDirty();
      },
      welcomeMessageEnabled,
      setWelcomeMessageEnabled: (on) => {
        if (on) {
          setWelcomeMessage(welcomeStashRef.current);
        } else {
          welcomeStashRef.current = welcomeMessage;
        }
        setWelcomeMessageEnabledState(on);
        markDirty();
      },
      exampleQuestions,
      setExampleQuestions: (v) => {
        setExampleQuestions(v);
        markDirty();
      },
      dirty,
      saving,
      saveError,
      save,
      hydrateFromBot,
    }),
    [
      activeSubnav,
      selectedCategories,
      setSelectedCategoriesWrapped,
      customCategoryMode,
      setCustomCategoryModeWrapped,
      customCategoryText,
      setCustomCategoryTextWrapped,
      toggleCategoryPill,
      behaviorPreset,
      tone,
      personalityDescription,
      thingsToAvoid,
      welcomeMessage,
      welcomeMessageEnabled,
      exampleQuestions,
      dirty,
      saving,
      saveError,
      save,
      hydrateFromBot,
      markDirty,
    ],
  );

  return <BehaviorWorkspaceContext.Provider value={value}>{children}</BehaviorWorkspaceContext.Provider>;
}

export function useBehaviorWorkspace(): BehaviorWorkspaceValue {
  const ctx = useContext(BehaviorWorkspaceContext);
  if (!ctx) throw new Error('useBehaviorWorkspace must be used within BehaviorWorkspaceProvider');
  return ctx;
}
