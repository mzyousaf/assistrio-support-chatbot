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
import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';
import { kbPlanLimitClientDescription } from '@/lib/knowledgeContentUtf8Limits';
import {
  toastPlaygroundSectionSaveFailed,
  toastPlaygroundSectionSaved,
  toastPlaygroundValidationWarning,
} from '@/lib/playgroundSectionSaveToasts';
import { patchAdminBot, postAdminKnowledgeSuggestionsSync } from '@/api/adminApi';
import {
  BEHAVIOR_PRESETS,
  behaviorPresetToPrompt,
  CUSTOM_CATEGORY_PILL,
  EXAMPLE_QUESTIONS_MAX,
  MAX_CATEGORY_PILLS,
  parseCategoriesFromBot,
  VALID_TONE_VALUES,
} from './behaviorConstants';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import {
  exampleQuestionsToPatchPayload,
  hydrateExampleQuestionsFromBot,
  type ExampleQuestionItem,
} from './exampleQuestionHelpers';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';

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
  exampleQuestions: ExampleQuestionItem[];
  setExampleQuestions: (v: ExampleQuestionItem[]) => void;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  save: () => Promise<void>;
  /** Reset local editor state from the current `bot` snapshot (e.g. after discard). */
  hydrateFromBot: () => void;
};

const BehaviorWorkspaceContext = createContext<BehaviorWorkspaceValue | null>(null);

export function BehaviorWorkspaceProvider({ children }: { children: ReactNode }) {
  const { bot, botId, softReload } = useAdminBotWorkspace();

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
  const [exampleQuestions, setExampleQuestions] = useState<ExampleQuestionItem[]>([]);

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
    setCustomCategoryText(clampStr(parsed.customText, BOT_FIELD_MAX.categoryText));

    const p = bot.personality;
    const pr = String(p?.behaviorPreset ?? 'default');
    setBehaviorPreset(BEHAVIOR_PRESETS.some((x) => x.value === pr) ? pr : 'default');
    const t = String(p?.tone ?? 'friendly');
    setTone(VALID_TONE_VALUES.has(t) ? t : 'friendly');
    setPersonalityDescription(
      clampStr(typeof p?.description === 'string' ? p.description : '', BOT_FIELD_MAX.personalityDescription),
    );
    setThingsToAvoid(
      clampStr(typeof p?.thingsToAvoid === 'string' ? p.thingsToAvoid : '', BOT_FIELD_MAX.thingsToAvoid),
    );

    const wm = clampStr(typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage : '', BOT_FIELD_MAX.welcomeMessage);
    setWelcomeMessage(wm);
    welcomeStashRef.current = wm;
    setWelcomeMessageEnabledState(
      bot.welcomeMessageEnabled === false ? false : Boolean(wm.trim()),
    );
    setExampleQuestions(hydrateExampleQuestionsFromBot(bot));

    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrateFromBot();
  }, [hydrateFromBot]);

  useEffect(() => {
    return registerManualSaveGuard('behavior', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

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
    const desc = clampStr(personalityDescription.trim(), BOT_FIELD_MAX.personalityDescription);
    if (!desc) {
      setSaveError('Instructions are required to define how your bot behaves.');
      toastPlaygroundValidationWarning(
        'Instructions required',
        'Add guidance under Personality so your bot knows how to respond.',
      );
      setActiveSubnav('personality');
      return;
    }

    let categoriesPayload: string[] = [];
    if (customCategoryMode) {
      const c = clampStr(customCategoryText.trim().toLowerCase(), BOT_FIELD_MAX.categoryText);
      if (!c) {
        setSaveError('Enter a custom category, or switch back to predefined categories.');
        toastPlaygroundValidationWarning(
          'Custom category missing',
          'Enter a category label or switch back to predefined categories.',
        );
        setActiveSubnav('personality');
        return;
      }
      categoriesPayload = [c];
    } else {
      if (selectedCategories.length === 0) {
        setSaveError('Select at least one category.');
        toastPlaygroundValidationWarning(
          'Category required',
          'Pick at least one category that describes your bot.',
        );
        setActiveSubnav('personality');
        return;
      }
      if (selectedCategories.length > MAX_CATEGORY_PILLS) {
        setSaveError(`Select at most ${MAX_CATEGORY_PILLS} categories.`);
        toastPlaygroundValidationWarning(
          'Too many categories',
          `You can select up to ${MAX_CATEGORY_PILLS} categories. Remove one to continue.`,
        );
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
      systemPrompt: clampStr(combinedSystemPrompt.trim(), BOT_FIELD_MAX.personalitySystemPrompt) || undefined,
    };
    const nameTrimmed =
      typeof raw.name === 'string' ? clampStr(raw.name.trim(), BOT_FIELD_MAX.personalityName) : '';
    if (nameTrimmed) personalityPayload.name = nameTrimmed;
    const langTrimmed =
      typeof raw.language === 'string' ? clampStr(raw.language.trim(), BOT_FIELD_MAX.personalityLanguage) : '';
    if (langTrimmed) personalityPayload.language = langTrimmed;
    const tta = clampStr(thingsToAvoid.trim(), BOT_FIELD_MAX.thingsToAvoid);
    if (tta) personalityPayload.thingsToAvoid = tta;

    const examplePatch = exampleQuestionsToPatchPayload(exampleQuestions).slice(0, EXAMPLE_QUESTIONS_MAX);

    setSaving(true);
    setSaveError(null);

    const sugRes = await postAdminKnowledgeSuggestionsSync(botId, examplePatch);
    if (!sugRes.ok) {
      setSaving(false);
      const msg = kbPlanLimitClientDescription(sugRes.errorCode, sugRes.error, sugRes.body);
      setSaveError(msg);
      toastPlaygroundSectionSaveFailed('behavior', msg);
      return;
    }

    const res = await patchAdminBot(botId, {
      categories: categoriesPayload,
      welcomeMessage: clampStr(welcomeMessage.trim(), BOT_FIELD_MAX.welcomeMessage),
      welcomeMessageEnabled,
      personality: personalityPayload,
    });
    setSaving(false);
    if (!res.ok) {
      const msg = kbPlanLimitClientDescription(res.errorCode, res.error, res.body);
      setSaveError(msg);
      toastPlaygroundSectionSaveFailed('behavior', msg);
      return;
    }
    toastPlaygroundSectionSaved('behavior');
    setDirty(false);
    await softReload();
    if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
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
