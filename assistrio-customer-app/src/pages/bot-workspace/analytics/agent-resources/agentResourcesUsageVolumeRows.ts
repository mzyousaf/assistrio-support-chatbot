import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageSummary,
} from '@/api/types';
import { formatAnalyticsCredits, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import {
  billedCreditsFromCount,
  buildUsageCreditRuleLookup,
  creditsPerUnit,
  usageCreditSplitFromSummary,
} from './agentResourcesUsageCredits.util';
import type { AgentResourcesUsageVolumeFormula, AgentResourcesUsageVolumeRow } from './AgentResourcesUsageVolumeRankingCard';
import { AGENT_RESOURCES_USAGE_SERIES, type AgentResourcesUsageSeriesId } from './agentResourcesUsageTrendTheme';

function mergedTextMessageCount(summary: CustomerAgentResourcesUsageSummary): number {
  return (
    Math.max(0, Math.trunc(Number(summary.textMessages ?? 0))) +
    Math.max(0, Math.trunc(Number(summary.suggestedQuestionMessages ?? 0)))
  );
}

function splitMagnitude(split: ReturnType<typeof usageCreditSplitFromSummary>, id: AgentResourcesUsageSeriesId): number {
  switch (id) {
    case 'textCredits':
      return split.textCredits;
    case 'voiceCredits':
      return split.voiceCredits;
    case 'dictationCredits':
      return split.dictationCredits;
    case 'totalCreditsUsed':
      return split.totalCreditsUsed;
    default:
      return split.totalCreditsUsed;
  }
}

/** Rows + detail lines shared by Credit Usage KPI cards and “Usage in range”. */
export function buildAgentResourcesUsageVolumeRows(
  summary: CustomerAgentResourcesUsageSummary,
  creditRules: CustomerAgentResourcesUsageCreditRule[],
): AgentResourcesUsageVolumeRow[] {
  const lookup = buildUsageCreditRuleLookup(creditRules);

  if (summary.componentRows != null) {
    const byKey = new Map(summary.componentRows.map((r) => [r.key, r]));

    return AGENT_RESOURCES_USAGE_SERIES.map((s) => {
      if (s.id === 'totalCreditsUsed') {
        const magnitude = Number(summary.totalCreditsUsed ?? 0);
        return {
          id: s.id,
          label: s.label,
          color: s.color,
          magnitude,
          detailLine: `= ${formatAnalyticsCredits(magnitude)}`,
          formula: { kind: 'total', credits: formatAnalyticsCredits(magnitude) },
        };
      }

      const usageType = s.mapsToUsageType;
      const row = byKey.get(usageType);
      const count =
        row?.count ??
        (usageType === 'text_message'
          ? mergedTextMessageCount(summary)
          : usageType === 'voice_message'
            ? Math.max(0, Math.trunc(Number(summary.voiceMessages ?? 0)))
            : usageType === 'dictation_session'
              ? Math.max(0, Math.trunc(Number(summary.voiceDictationSessions ?? 0)))
              : 0);

      const creditsEach = row?.creditsEach ?? creditsPerUnit(usageType, lookup);
      const magnitude =
        row?.creditsUsed ?? billedCreditsFromCount(count, usageType, lookup);

      const noun = usageType === 'dictation_session' ? 'sessions' : 'messages';

      const formula: AgentResourcesUsageVolumeFormula = {
        kind: 'usage',
        quantity: formatAnalyticsInteger(count),
        noun,
        unitCost: formatAnalyticsCredits(creditsEach),
        credits: formatAnalyticsCredits(magnitude),
      };

      const detailLine = `${formula.quantity} ${formula.noun} x ${formula.unitCost} = ${formula.credits}`;

      return {
        id: s.id,
        label: s.label,
        color: s.color,
        magnitude,
        detailLine,
        formula,
      };
    });
  }

  const creditSplitSummary = usageCreditSplitFromSummary(summary, lookup);

  return AGENT_RESOURCES_USAGE_SERIES.map((s) => {
    const magnitude = splitMagnitude(creditSplitSummary, s.id);

    let formula: AgentResourcesUsageVolumeFormula;
    if (s.id === 'textCredits') {
      const count = mergedTextMessageCount(summary);
      formula = {
        kind: 'usage',
        quantity: formatAnalyticsInteger(count),
        noun: 'messages',
        unitCost: formatAnalyticsCredits(creditsPerUnit('text_message', lookup)),
        credits: formatAnalyticsCredits(magnitude),
      };
    } else if (s.id === 'voiceCredits') {
      const count = Math.max(0, Math.trunc(Number(summary.voiceMessages ?? 0)));
      formula = {
        kind: 'usage',
        quantity: formatAnalyticsInteger(count),
        noun: 'messages',
        unitCost: formatAnalyticsCredits(creditsPerUnit('voice_message', lookup)),
        credits: formatAnalyticsCredits(magnitude),
      };
    } else if (s.id === 'dictationCredits') {
      const count = Math.max(0, Math.trunc(Number(summary.voiceDictationSessions ?? 0)));
      formula = {
        kind: 'usage',
        quantity: formatAnalyticsInteger(count),
        noun: 'sessions',
        unitCost: formatAnalyticsCredits(creditsPerUnit('dictation_session', lookup)),
        credits: formatAnalyticsCredits(magnitude),
      };
    } else {
      formula = { kind: 'total', credits: formatAnalyticsCredits(magnitude) };
    }

    const detailLine =
      formula.kind === 'total'
        ? `= ${formula.credits}`
        : `${formula.quantity} ${formula.noun} x ${formula.unitCost} = ${formula.credits}`;

    return {
      id: s.id,
      label: s.label,
      color: s.color,
      magnitude,
      detailLine,
      formula,
    };
  });
}
