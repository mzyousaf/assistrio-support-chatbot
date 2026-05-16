import type { Bot } from '../models';
import type { KnowledgeSmartScheduleContext } from './knowledge-smart-schedule.util';
import { resolveSmartTrainingDelayMinutes } from './knowledge-smart-schedule.util';

export type KnowledgeTrainingSettingsResolved = {
  autoTrainEnabled: boolean;
  trainingDelayMinutes: number;
  scheduleMode: 'smart' | 'fixed';
};

/**
 * Read effective training settings from a Bot document (or lean object).
 * Defaults: autoTrainEnabled=true, trainingDelayMinutes=5.
 */
export function getKnowledgeTrainingSettings(
  bot: Pick<Bot, 'knowledgeTraining'> | null | undefined,
): KnowledgeTrainingSettingsResolved {
  const kt = bot?.knowledgeTraining;
  const scheduleMode: 'smart' | 'fixed' =
    kt?.scheduleMode === 'fixed' ? 'fixed' : 'smart';
  return {
    autoTrainEnabled: kt?.autoTrainEnabled !== false,
    trainingDelayMinutes:
      typeof kt?.trainingDelayMinutes === 'number' && Number.isFinite(kt.trainingDelayMinutes) && kt.trainingDelayMinutes >= 0
        ? Math.floor(kt.trainingDelayMinutes)
        : 5,
    scheduleMode,
  };
}

export function trainingRunAfterFrom(queuedAt: Date, trainingDelayMinutes: number): Date {
  return new Date(queuedAt.getTime() + trainingDelayMinutes * 60_000);
}

/**
 * Auto-train schedule for a KB item when its content needs (re)training.
 * First successful training (no prior `lastTrainedAt`) runs immediately; later updates respect smart per-type delay when `smartSchedule` is set.
 */
export function computeAutomaticItemRunAfter(
  queuedAt: Date,
  trainingDelayMinutesFallback: number,
  hasTrainedBefore: boolean,
  smartSchedule?: KnowledgeSmartScheduleContext,
): Date {
  if (!hasTrainedBefore) {
    return queuedAt;
  }
  const mins = smartSchedule
    ? resolveSmartTrainingDelayMinutes(smartSchedule)
    : trainingDelayMinutesFallback;
  return trainingRunAfterFrom(queuedAt, mins);
}
