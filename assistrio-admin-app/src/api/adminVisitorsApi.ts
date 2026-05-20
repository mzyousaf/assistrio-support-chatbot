import { adminFetch } from './client';
import type {
  AdminVisitorDetailResponse,
  AdminVisitorListItem,
  AdminVisitorsListParams,
} from './adminVisitorsTypes';
import type { ApiResult } from './types';

const BASE = '/api/admin/visitors';

/**
 * List marketing/funnel visitors. Backend returns the full set (no server pagination yet).
 * `params` is accepted for forward compatibility but not sent until the API supports filters.
 */
export function getAdminVisitors(_params?: AdminVisitorsListParams) {
  return adminFetch<AdminVisitorListItem[]>(BASE);
}

export function getAdminVisitorDetail(visitorId: string) {
  return adminFetch<AdminVisitorDetailResponse>(
    `${BASE}/${encodeURIComponent(visitorId)}`,
  );
}

export type { ApiResult };
