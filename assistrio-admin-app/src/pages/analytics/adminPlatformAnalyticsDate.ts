import {
  computeDateRangeFromAnalyticsPreset,
  type AnalyticsDateRangeSlice,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type AdminPlatformAnalyticsDatePreset = ChatsAnalyticsDatePreset;

export type AdminPlatformAnalyticsDateState = AnalyticsDateRangeSlice;

export const ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS: AdminPlatformAnalyticsDateState = {
  preset: '30d',
  customFrom: '',
  customTo: '',
};

export function buildAdminPlatformAnalyticsDateParams(
  state: AdminPlatformAnalyticsDateState,
): { from: string; to: string } {
  return computeDateRangeFromAnalyticsPreset(state, { invalidCustomFallbackLastDays: 30 });
}
