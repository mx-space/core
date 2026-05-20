ALTER TABLE "enrichment_screenshots" RENAME TO "enrichment_captures";
--> statement-breakpoint
ALTER INDEX "enrichment_screenshots_lru_idx" RENAME TO "enrichment_captures_lru_idx";
--> statement-breakpoint
ALTER TABLE "enrichment_captures" RENAME CONSTRAINT "enrichment_screenshots_enrichment_id_enrichment_cache_id_fk" TO "enrichment_captures_enrichment_id_enrichment_cache_id_fk";
--> statement-breakpoint
UPDATE "enrichment_cache"
SET "normalized" = (
    "normalized"
    || jsonb_build_object('thumbnailImage', "normalized" -> 'image')
    || jsonb_build_object('captureImage', "normalized" -> 'screenshot')
  ) - 'image' - 'screenshot'
WHERE "normalized" ? 'image' OR "normalized" ? 'screenshot';
