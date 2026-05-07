-- Clear stale `last_error` rows left over from the locale-column rollout
-- (migrations 0006/0007 + commit 5c68e813). Pre-rollout code emitted
-- `on conflict ("provider","external_id")` against a unique index that had
-- been swapped to the 3-tuple `(provider, external_id, locale)`, producing
-- `Failed query: ...` strings in last_error. Current code uses the 3-tuple
-- onConflict target and no longer generates this pattern; reset failure_count
-- so SWR exits backoff and the next reader refreshes the row naturally.
UPDATE "enrichment_cache"
SET "last_error" = NULL,
    "failure_count" = 0
WHERE "last_error" LIKE 'Failed query: insert into%on conflict ("provider","external_id")%';
