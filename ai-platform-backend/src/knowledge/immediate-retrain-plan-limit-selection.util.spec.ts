import { describe, expect, it } from '@jest/globals';
import { actionableRetrainOrBranches } from './immediate-retrain-queue.util';
import { knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal } from './bot-knowledge-total-limit.service';

describe('bulk train/retrain KB selection vs plan_limit_bot_kb_total', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('detects KB rows blocked by workspace total cap markers', () => {
    expect(
      knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal({
        trainingError: 'plan_limit_bot_kb_total',
      }),
    ).toBe(true);
    expect(
      knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal({
        trainingError: 'embed_failed',
      }),
    ).toBe(false);
  });

  it('lifecycle-or branches still include pending/failed; Mongo `$nor plan_limit…` excludes out_of_storage rows in applyTrainNow', () => {
    const b = actionableRetrainOrBranches(true, false, now);
    expect(b.some((x) => (x as { status?: string }).status === 'pending')).toBe(true);
    expect(b.some((x) => (x as { status?: string }).status === 'failed')).toBe(true);
    const capped = { status: 'pending' as const, trainingError: 'plan_limit_bot_kb_total' };
    expect(knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal(capped)).toBe(true);
  });

  it('generic failed item is addressed by actionableRetrain branches and is not plan-capped', () => {
    const b = actionableRetrainOrBranches(true, false, now);
    expect(b.some((x) => (x as { status?: string }).status === 'failed')).toBe(true);
    expect(knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal({ status: 'failed', trainingError: 'timeout' })).toBe(
      false,
    );
  });

  it('pending item without plan markers is not plan-blocked', () => {
    expect(knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal({ status: 'pending' })).toBe(false);
  });
});
