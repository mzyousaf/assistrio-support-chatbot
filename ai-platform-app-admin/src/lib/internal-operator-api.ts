/**
 * Browser API paths for this internal admin app (Nest `AdminSessionAuthGuard` + `SuperAdminGuard` on data routes).
 * Internal operator HTTP helpers — all paths are under `/api/admin/*`.
 */
export const ADMIN_API_BOTS = "/api/admin/bots";
export const ADMIN_API_ANALYTICS = "/api/admin/analytics";
export const ADMIN_API_VISITORS = "/api/admin/visitors";
export const ADMIN_API_SEED = "/api/admin/seed";
export const ADMIN_API_UPLOAD = "/api/admin/upload";
export const ADMIN_API_JOBS = "/api/admin/jobs";
/** POST `${ADMIN_API_OPENAI}/test-key` with JSON `{ apiKey }` */
export const ADMIN_API_OPENAI = "/api/admin/openai";
