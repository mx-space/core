-- 0030_smooth_ultragirl shipped with a journal `when` below 0029's, so the
-- schema migrator's waterline backfill recorded it as applied without ever
-- running its SQL. Databases migrated by v13.25.2 therefore have the ledger
-- row but not the column; re-apply it idempotently.
ALTER TABLE "ai_translations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
