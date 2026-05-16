import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageSummary,
  CustomerAgentResourcesUsageTimePoint,
} from '@/api/types';

export function buildUsageCreditRuleLookup(
  rules: CustomerAgentResourcesUsageCreditRule[],
): Map<string, CustomerAgentResourcesUsageCreditRule> {
  const m = new Map<string, CustomerAgentResourcesUsageCreditRule>();
  for (const r of rules) {
    m.set(r.usageType, r);
  }
  return m;
}

export function creditsPerUnit(
  usageType: string,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): number {
  const r = lookup.get(usageType);
  if (!r?.enabled) return 0;
  const n = Number(r.credits);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Billable credits = integer count × per-unit credits (respects exclude-from-total rules). */
export function billedCreditsFromCount(
  count: unknown,
  usageType: string,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): number {
  const r = lookup.get(usageType);
  if ((r?.includeInTotalCredits ?? true) !== true) return 0;
  const c = Math.max(0, Math.trunc(Number(count ?? 0)));
  return c * creditsPerUnit(usageType, lookup);
}

/** Suggested-question usage is billed like text (1 credit); merged for analytics/display only. */
function textCreditsFromCounts(
  textMessages: unknown,
  suggestedQuestionMessages: unknown,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): number {
  return (
    billedCreditsFromCount(textMessages, 'text_message', lookup) +
    billedCreditsFromCount(suggestedQuestionMessages ?? 0, 'text_message', lookup)
  );
}

export type UsageCreditSplit = {
  textCredits: number;
  voiceCredits: number;
  dictationCredits: number;
  totalCreditsUsed: number;
};

export function creditSplitFromTimePoint(
  p: CustomerAgentResourcesUsageTimePoint,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): UsageCreditSplit {
  return {
    textCredits: textCreditsFromCounts(p.textMessages, p.suggestedQuestionMessages, lookup),
    voiceCredits: billedCreditsFromCount(p.voiceMessages, 'voice_message', lookup),
    dictationCredits: billedCreditsFromCount(p.voiceDictationSessions, 'dictation_session', lookup),
    totalCreditsUsed: Number(p.totalCreditsUsed ?? 0),
  };
}

/** Prefers server-side attribution when present so UI splits match billed `creditCost` / totals. */
export function usageCreditSplitFromTimePoint(
  p: CustomerAgentResourcesUsageTimePoint,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): UsageCreditSplit {
  if (
    p.textCreditsAttributed != null &&
    p.voiceCreditsAttributed != null &&
    p.dictationCreditsAttributed != null
  ) {
    const textAttributed =
      Math.max(0, Number(p.textCreditsAttributed)) +
      Math.max(0, Number(p.suggestedQuestionCreditsAttributed ?? 0));
    return {
      textCredits: textAttributed,
      voiceCredits: Math.max(0, Number(p.voiceCreditsAttributed)),
      dictationCredits: Math.max(0, Number(p.dictationCreditsAttributed)),
      totalCreditsUsed: Number(p.totalCreditsUsed ?? 0),
    };
  }
  return creditSplitFromTimePoint(p, lookup);
}

export function creditSplitFromSummary(
  summary: CustomerAgentResourcesUsageSummary,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): UsageCreditSplit {
  return {
    textCredits: textCreditsFromCounts(summary.textMessages, summary.suggestedQuestionMessages, lookup),
    voiceCredits: billedCreditsFromCount(summary.voiceMessages, 'voice_message', lookup),
    dictationCredits: billedCreditsFromCount(summary.voiceDictationSessions, 'dictation_session', lookup),
    totalCreditsUsed: Number(summary.totalCreditsUsed ?? 0),
  };
}

export function usageCreditSplitFromSummary(
  summary: CustomerAgentResourcesUsageSummary,
  lookup: Map<string, CustomerAgentResourcesUsageCreditRule>,
): UsageCreditSplit {
  if (summary.componentRows != null) {
    const pick = (key: string) =>
      summary.componentRows!.find((r) => r.key === key)?.creditsUsed ?? 0;
    return {
      textCredits: Math.max(0, Number(pick('text_message'))),
      voiceCredits: Math.max(0, Number(pick('voice_message'))),
      dictationCredits: Math.max(0, Number(pick('dictation_session'))),
      totalCreditsUsed: Number(summary.totalCreditsUsed ?? 0),
    };
  }
  if (
    summary.textCreditsAttributed != null &&
    summary.voiceCreditsAttributed != null &&
    summary.dictationCreditsAttributed != null
  ) {
    const textAttributed =
      Math.max(0, Number(summary.textCreditsAttributed)) +
      Math.max(0, Number(summary.suggestedQuestionCreditsAttributed ?? 0));
    return {
      textCredits: textAttributed,
      voiceCredits: Math.max(0, Number(summary.voiceCreditsAttributed)),
      dictationCredits: Math.max(0, Number(summary.dictationCreditsAttributed)),
      totalCreditsUsed: Number(summary.totalCreditsUsed ?? 0),
    };
  }
  return creditSplitFromSummary(summary, lookup);
}

export function usageSummaryHasServerAttribution(summary: CustomerAgentResourcesUsageSummary): boolean {
  return (
    summary.componentRows != null ||
    (summary.textCreditsAttributed != null &&
      summary.voiceCreditsAttributed != null &&
      summary.dictationCreditsAttributed != null)
  );
}
