/** Workspace plan tier keys. */
export const PLAN_KEYS = ['free', 'starter', 'pro'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceMonthlyUsd: number;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  maxKbStorageMbPerBot: number;
  /** `null` = unlimited analytics history retention. */
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
};

export const FREE_PLAN: PlanDefinition = {
  key: 'free',
  name: 'Free',
  priceMonthlyUsd: 0,
  botLimit: 1,
  memberLimit: 3,
  monthlyAiCredits: 50,
  kbStorageMbPerBot: 10,
  maxKbStorageMbPerBot: 40,
  analyticsHistoryDays: 7,
  canExportReports: false,
  showPoweredByAssistrio: true,
};

export const STARTER_PLAN: PlanDefinition = {
  key: 'starter',
  name: 'Starter',
  priceMonthlyUsd: 49,
  botLimit: 1,
  memberLimit: 3,
  monthlyAiCredits: 500,
  kbStorageMbPerBot: 15,
  maxKbStorageMbPerBot: 40,
  analyticsHistoryDays: null,
  canExportReports: true,
  showPoweredByAssistrio: true,
};

export const PRO_PLAN: PlanDefinition = {
  key: 'pro',
  name: 'Pro',
  priceMonthlyUsd: 99,
  botLimit: 1,
  memberLimit: 5,
  monthlyAiCredits: 3000,
  kbStorageMbPerBot: 25,
  maxKbStorageMbPerBot: 40,
  analyticsHistoryDays: null,
  canExportReports: true,
  showPoweredByAssistrio: true,
};

export const PLAN_CATALOG: readonly PlanDefinition[] = [FREE_PLAN, STARTER_PLAN, PRO_PLAN];

const PLAN_BY_KEY: Record<PlanKey, PlanDefinition> = {
  free: FREE_PLAN,
  starter: STARTER_PLAN,
  pro: PRO_PLAN,
};

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as readonly string[]).includes(value);
}

export function getPlanByKey(key: string | null | undefined): PlanDefinition {
  const k = String(key ?? '').trim();
  if (isPlanKey(k)) return PLAN_BY_KEY[k];
  return FREE_PLAN;
}

export function megabytesToBytes(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}
