export type WorkspaceBillingPlanCatalogCard = {
  key: string;
  name: string;
  priceMonthly: number;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  checkoutAvailable: boolean;
};

export type WorkspaceBillingAddonCatalogCard = {
  key: string;
  name: string;
  billingInterval: "one_time" | "monthly";
  priceUsd: number;
  scope: "workspace" | "bot";
  checkoutAvailable: boolean;
};

export type WorkspaceBillingSummary = {
  plan: { key: string };
  entitlements: { isTrialPlan: boolean; addonsAllowed: boolean };
  planCatalog: WorkspaceBillingPlanCatalogCard[];
  addonCatalog: WorkspaceBillingAddonCatalogCard[];
};
