import type { AdminBotWorkspaceBot, AdminKnowledgeStatusItem } from '@/api/types';
import { pickBetterKnowledgeStatusItem, pollRowEligibleForKbMerge } from '@/lib/knowledgeStatusPollUtils';
import { normalizeKnowledgeTrainingStatus, type KnowledgeTrainingStatus } from '@/lib/knowledgeTrainingStatus';
import { kbDetailLifecycleRawForDisplay, kbPollRunAfterIso } from './knowledgePollDisplayHelpers';
import {
  clampStrUtf8Bytes,
  KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES,
  KB_PLAN_SUGGESTION_DESCRIPTION_MAX_UTF8_BYTES,
} from '@/lib/knowledgeContentUtf8Limits';
import { EXAMPLE_QUESTIONS_BACKEND_MAX } from './behaviorConstants';

export type ExampleQuestionItem = {
  label: string;
  context: string;
  active?: boolean;
  /** Index in persisted exampleQuestions — for KB status polling */
  suggestionIndex?: number;
  /** Stable KB row id — merge polling after deletes */
  knowledgeItemId?: string;
  trainingStatus?: KnowledgeTrainingStatus;
  displayStatus?: string;
  displayLabel?: string | null;
  lastQueuedAt?: string | null;
  runAfter?: string | null;
  lastTrainingStartedAt?: string | null;
  lastTrainedAt?: string | null;
  trainingError?: string | null;
  /** From KB status `displayLabel` */
  trainingDisplayLabel?: string;
  /** Raw poll `trainingStatus` string (parallel to `status`). */
  kbApiTrainingStatus?: string | null;
  /** Widget: hide visible chip label (button stays tappable). */
  hideChipTextInChat?: boolean;
};

/** True when any suggestion has non-empty scoped text (counts toward KB). Chip labels alone do not. */
export function suggestionListHasScopedKnowledge(items: ExampleQuestionItem[]): boolean {
  return items.some((s) => Boolean(s.context?.trim()));
}

const SCOPED_KEYS = ['context', 'description', 'scopedInformation'] as const;

function firstScopedFromObject(o: Record<string, unknown>): string {
  for (const k of SCOPED_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function hydrateExampleQuestionsFromBot(bot: AdminBotWorkspaceBot | null | undefined): ExampleQuestionItem[] {
  const raw = bot?.exampleQuestions;
  if (!Array.isArray(raw)) return [];
  const out: ExampleQuestionItem[] = [];
  let idxRun = 0;
  for (const item of raw) {
    if (typeof item === 'string') {
      const label = clampStrUtf8Bytes(item.trim(), KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES);
      if (label.length > 0) out.push({ label, context: '', suggestionIndex: idxRun++, active: true });
    } else if (item && typeof item === 'object') {
      const o = item as {
        label?: string;
        text?: string;
        context?: string;
        description?: string;
        scopedInformation?: string;
        active?: unknown;
        knowledgeItemId?: unknown;
        trainingStatus?: unknown;
        displayStatus?: unknown;
        displayLabel?: unknown;
        lastTrainedAt?: unknown;
        hideChipTextInChat?: unknown;
      };
      const labelRaw = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
      const label = clampStrUtf8Bytes(String(labelRaw).trim(), KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES);
      if (label.length === 0) continue;
      const rawScoped = firstScopedFromObject(item as Record<string, unknown>);
      const context = rawScoped
        ? clampStrUtf8Bytes(rawScoped, KB_PLAN_SUGGESTION_DESCRIPTION_MAX_UTF8_BYTES)
        : '';
      const suggestionIndex = idxRun++;
      const row: ExampleQuestionItem = {
        label,
        context,
        suggestionIndex,
        active: o.active === false ? false : true,
        ...(o.hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
      };
      if (typeof o.knowledgeItemId === 'string' && o.knowledgeItemId.trim()) {
        row.knowledgeItemId = o.knowledgeItemId.trim();
      }
      if (o.trainingStatus != null && `${o.trainingStatus}`.trim() !== '') {
        row.trainingStatus = normalizeKnowledgeTrainingStatus(String(o.trainingStatus));
      }
      const dsRaw = typeof o.displayStatus === 'string' ? o.displayStatus.trim() : '';
      if (dsRaw) row.displayStatus = dsRaw;
      const dlRaw = typeof o.displayLabel === 'string' ? o.displayLabel.trim() : '';
      if (dlRaw) {
        row.displayLabel = dlRaw;
        row.trainingDisplayLabel = dlRaw;
      }
      if ('lastTrainedAt' in o) {
        const lt = o.lastTrainedAt;
        row.lastTrainedAt = typeof lt === 'string' && lt.trim() ? lt : lt === null ? null : undefined;
      }
      out.push(row);
    }
    if (out.length >= EXAMPLE_QUESTIONS_BACKEND_MAX) break;
  }
  return out;
}

export function mergeExampleQuestionsWithKbStatusPoll(
  base: ExampleQuestionItem[],
  poll: AdminKnowledgeStatusItem[] | null | undefined,
): ExampleQuestionItem[] {
  if (!poll || poll.length === 0) return base;
  const byId = new Map<string, AdminKnowledgeStatusItem>();
  const byIdx = new Map<number, AdminKnowledgeStatusItem>();
  for (const it of poll) {
    if (!pollRowEligibleForKbMerge(it, 'suggestion')) continue;
    if (it.id) byId.set(it.id.trim(), it);
    if (typeof it.suggestionIndex === 'number' && Number.isFinite(it.suggestionIndex)) {
      const prev = byIdx.get(it.suggestionIndex);
      byIdx.set(it.suggestionIndex, prev ? pickBetterKnowledgeStatusItem(prev, it) : it);
    }
  }
  if (byId.size === 0 && byIdx.size === 0) return base;
  return base.map((row) => {
    const kid = typeof row.knowledgeItemId === 'string' ? row.knowledgeItemId.trim() : '';
    const idx = row.suggestionIndex;
    const u =
      kid && byId.has(kid)
        ? byId.get(kid)
        : typeof idx === 'number' && Number.isFinite(idx)
          ? byIdx.get(idx)
          : undefined;
    if (!u) return row;
    const pollLabel =
      u.displayLabel != null && String(u.displayLabel).trim() ? String(u.displayLabel).trim() : undefined;
    const { displayLabel: _stripDl, trainingDisplayLabel: _stripTdl, ...rest } = row;
    const pollId = typeof u.id === 'string' && u.id.trim() ? u.id.trim() : '';
    return {
      ...rest,
      ...(pollId ? { knowledgeItemId: pollId } : {}),
      trainingStatus: (() => {
        const ts = u.trainingStatus != null && String(u.trainingStatus).trim();
        if (ts === 'out_of_storage') return 'out_of_storage';
        const raw = kbDetailLifecycleRawForDisplay(row.trainingStatus, u);
        return normalizeKnowledgeTrainingStatus(raw);
      })(),
      lastQueuedAt: u.lastQueuedAt ?? row.lastQueuedAt ?? null,
      runAfter: kbPollRunAfterIso(u),
      lastTrainingStartedAt: u.lastTrainingStartedAt ?? row.lastTrainingStartedAt ?? null,
      lastTrainedAt: u.lastTrainedAt ?? row.lastTrainedAt,
      ...(u.trainingError != null && String(u.trainingError).trim()
        ? { trainingError: String(u.trainingError).trim() }
        : {}),
      ...(pollLabel !== undefined ? { displayLabel: pollLabel, trainingDisplayLabel: pollLabel } : {}),
      ...(u.displayStatus != null && String(u.displayStatus).trim()
        ? { displayStatus: String(u.displayStatus).trim() }
        : {}),
      ...(typeof u.trainingStatus === 'string' && u.trainingStatus.trim()
        ? { kbApiTrainingStatus: u.trainingStatus.trim() }
        : {}),
      ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
    };
  });
}

export function exampleQuestionsToPatchPayload(
  items: ExampleQuestionItem[],
): Array<{ label: string; context?: string; active?: boolean; hideChipTextInChat?: boolean }> {
  return items
    .map(({ label, context, active, hideChipTextInChat }) => {
      const l = clampStrUtf8Bytes(label.trim(), KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES);
      if (l.length === 0) return null;
      const c =
        context.length > 0
          ? clampStrUtf8Bytes(context, KB_PLAN_SUGGESTION_DESCRIPTION_MAX_UTF8_BYTES)
          : '';
      const base = c.length > 0 ? { label: l, context: c } : { label: l };
      return {
        ...base,
        ...(active === false ? { active: false } : {}),
        ...(hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
      };
    })
    .filter((x): x is { label: string; context?: string; active?: boolean; hideChipTextInChat?: boolean } => x != null);
}

export function exampleQuestionLabelsOnly(items: ExampleQuestionItem[]): string[] {
  return items.map((x) => x.label).filter(Boolean);
}
