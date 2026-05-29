// Admin dashboard upgrade source. The admin SPA now lives in this repo
// (apps/admin) and is built into the release bundle at build time (out/admin).
// This GitHub reference is the legacy release-based upgrade source, kept as a
// configurable fallback until the S3 update channel (ADMIN_UPDATE_S3_BASE_URL)
// is implemented — see modules/pageproxy/admin-download.manager.ts.
export const ADMIN_DASHBOARD_REPO =
  process.env.ADMIN_DASHBOARD_REPO || 'mx-space/mx-admin'
