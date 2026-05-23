import { HttpException, HttpStatus } from '@nestjs/common';
import { buildBotKnowledgeSizeFromEntitlements } from '../entitlements/bot-knowledge-size-from-entitlements.util';
import type { WorkspaceEntitlements } from '../entitlements/workspace-entitlements.types';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from '../knowledge/bot-knowledge-total-limit.service';
import {
  incomingFaqSectionUtf8Bytes,
  incomingNoteSnippetSectionUtf8Bytes,
  incomingTableSectionUtf8Bytes,
} from '../knowledge/bot-knowledge-total-incoming.util';
import type { WorkspaceOnboardingDraftSnapshot } from './workspace-onboarding.types';
import { normalizeOnboardingKnowledge } from './workspace-onboarding-knowledge-normalize.util';

export const ONBOARDING_KB_LIMIT_EXCEEDED_CODE = 'onboarding_kb_limit_exceeded' as const;

const ABSOLUTE_MAX_KB_BYTES = 40 * 1024 * 1024;

export type OnboardingKbUsageSnapshot = {
  currentBytes: number;
  limitBytes: number;
  planKey: string;
  planName: string;
};

export function resolveOnboardingKbLimitBytes(entitlements: WorkspaceEntitlements): number {
  const fromPlan = buildBotKnowledgeSizeFromEntitlements(entitlements).maxBytes;
  return Math.min(fromPlan, ABSOLUTE_MAX_KB_BYTES);
}

export function estimateDraftTextKnowledgeBytes(draft: WorkspaceOnboardingDraftSnapshot): number {
  const normalized = normalizeOnboardingKnowledge(
    draft.knowledge as unknown as Parameters<typeof normalizeOnboardingKnowledge>[0],
  );
  let total = 0;
  for (const snippet of normalized.snippets) {
    total += incomingNoteSnippetSectionUtf8Bytes([
      { title: snippet.title, snippet: snippet.description, active: true },
    ]);
  }
  for (const qa of normalized.qas) {
    total += incomingFaqSectionUtf8Bytes([
      { title: qa.title, questions: qa.questions, answer: qa.answer, active: true },
    ]);
  }
  return total;
}

export function estimateStagedTableBytes(
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>,
): number {
  if (tables.length === 0) return 0;
  return incomingTableSectionUtf8Bytes(
    tables.map((t) => ({
      title: t.title,
      columns: t.columns,
      rows: t.rows,
      active: true,
    })),
  );
}

export function sumStagedFileBytes(items: Array<{ sizeBytes: number }>): number {
  let total = 0;
  for (const item of items) {
    const n = Math.max(0, Math.floor(item.sizeBytes));
    total += n;
  }
  return total;
}

export function buildOnboardingKbUsageSnapshot(
  entitlements: WorkspaceEntitlements,
  draft: WorkspaceOnboardingDraftSnapshot,
  stagedFileBytes: number,
  stagedTableBytes = 0,
): OnboardingKbUsageSnapshot {
  const limitBytes = resolveOnboardingKbLimitBytes(entitlements);
  const currentBytes =
    estimateDraftTextKnowledgeBytes(draft) + stagedFileBytes + stagedTableBytes;
  return {
    currentBytes,
    limitBytes,
    planKey: entitlements.planKey,
    planName: entitlements.planName,
  };
}

export function assertOnboardingKbWithinLimit(input: {
  entitlements: WorkspaceEntitlements;
  draft: WorkspaceOnboardingDraftSnapshot;
  stagedFileBytes: number;
  stagedTableBytes?: number;
  incomingBytes: number;
}): void {
  const usage = buildOnboardingKbUsageSnapshot(
    input.entitlements,
    input.draft,
    input.stagedFileBytes,
    input.stagedTableBytes ?? 0,
  );
  const incomingBytes = Math.max(0, Math.floor(input.incomingBytes));
  const projectedBytes = usage.currentBytes + incomingBytes;
  if (projectedBytes <= usage.limitBytes) return;

  throw new HttpException(
    {
      error: 'This upload would exceed your agent knowledge storage limit.',
      message: 'This upload would exceed your agent knowledge storage limit.',
      errorCode: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
      currentBytes: usage.currentBytes,
      attemptedBytes: incomingBytes,
      limitBytes: usage.limitBytes,
      projectedBytes,
      planKey: usage.planKey,
      planName: usage.planName,
    },
    HttpStatus.BAD_REQUEST,
  );
}
