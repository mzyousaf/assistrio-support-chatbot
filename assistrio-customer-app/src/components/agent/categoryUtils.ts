import {
  CATEGORY_OPTIONS,
  CUSTOM_CATEGORY_PILL,
  MAX_CATEGORY_PILLS,
} from '@/pages/bot-workspace/behaviorConstants';

const PREDEFINED_SET = new Set<string>(CATEGORY_OPTIONS.map((c) => c.value));

/** Default preset when none is saved — matches behavior workspace. */
export const DEFAULT_AGENT_CATEGORY = 'support';

export type AgentCategoryValue = {
  selectedPredefined: string[];
  customMode: boolean;
  customText: string;
};

function defaultPredefinedSelection(): string[] {
  return [DEFAULT_AGENT_CATEGORY];
}

export function emptyAgentCategoryValue(): AgentCategoryValue {
  return { selectedPredefined: defaultPredefinedSelection(), customMode: false, customText: '' };
}

/** Parse saved categories for onboarding/editor — always keeps at least one preset when not custom. */
export function parseCategoriesForEditor(categories: string[]): AgentCategoryValue {
  const raw = categories.map((c) => String(c).trim()).filter(Boolean);
  if (raw.length === 0) return emptyAgentCategoryValue();

  const lower = raw.map((c) => c.toLowerCase());
  const predefinedHits = lower.filter((c) => PREDEFINED_SET.has(c));
  const customVals = raw.filter((_, i) => !PREDEFINED_SET.has(lower[i]!));

  if (customVals.length > 0) {
    return {
      selectedPredefined: [],
      customMode: true,
      customText: customVals.join(', '),
    };
  }

  const uniq = [...new Set(predefinedHits)];
  const picked = uniq.slice(0, MAX_CATEGORY_PILLS);
  return {
    selectedPredefined: picked.length > 0 ? picked : defaultPredefinedSelection(),
    customMode: false,
    customText: '',
  };
}

export function categoriesToPayload(value: AgentCategoryValue): string[] {
  if (value.customMode) {
    const c = value.customText.trim();
    return c ? [c] : [];
  }
  return [...value.selectedPredefined];
}

export function hasAgentCategorySelection(value: AgentCategoryValue): boolean {
  return categoriesToPayload(value).length > 0;
}

export function toggleAgentCategoryPill(value: AgentCategoryValue, pill: string): AgentCategoryValue {
  if (pill === CUSTOM_CATEGORY_PILL) {
    return { selectedPredefined: [], customMode: true, customText: value.customText };
  }

  const selected = value.selectedPredefined;
  const has = selected.includes(pill);
  if (has) {
    if (selected.length <= 1) return value;
    return {
      ...value,
      customMode: false,
      customText: '',
      selectedPredefined: selected.filter((x) => x !== pill),
    };
  }
  if (selected.length >= MAX_CATEGORY_PILLS) return value;
  return {
    customMode: false,
    customText: '',
    selectedPredefined: [...selected, pill],
  };
}

export { CATEGORY_OPTIONS, CUSTOM_CATEGORY_PILL, MAX_CATEGORY_PILLS };
