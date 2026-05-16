# Legacy `/api/user/*` — **retired**

The combined browser surface under **`/api/user` and `/api/user/*`** has been **removed** from `ai-platform-backend`.

## Supported replacements

| Former area | Use instead |
|-------------|-------------|
| Staff auth / me / logout | `/api/admin/auth/*`, `/api/admin/me` |
| Customer me / logout | `/api/customer/me`, `/api/customer/auth/logout` |
| Customer sign-in (browser) | `/api/customer/auth/google/*` |
| Workspace bots / documents / chat | `/api/admin/*` or `/api/customer/*` |
| Internal analytics | `/api/admin/analytics/*` |
| Visitors (staff) | `/api/admin/visitors/*` |
| Seed / jobs (staff) | `/api/admin/seed/*`, `/api/admin/jobs/*` |
| Multipart upload (staff) | `/api/admin/upload` |

## Historical note

Observability for the old prefix (`LEGACY_API_USER_*` env vars and `src/legacy-api-user/*`) was removed together with the routes. This file remains as a pointer for anyone following old links or runbooks.
