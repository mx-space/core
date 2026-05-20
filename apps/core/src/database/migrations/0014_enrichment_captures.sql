ALTER TABLE "enrichment_screenshots" RENAME TO "enrichment_captures";
--> statement-breakpoint
ALTER INDEX "enrichment_screenshots_lru_idx" RENAME TO "enrichment_captures_lru_idx";
--> statement-breakpoint
ALTER TABLE "enrichment_captures" RENAME CONSTRAINT "enrichment_screenshots_enrichment_id_enrichment_cache_id_fk" TO "enrichment_captures_enrichment_id_enrichment_cache_id_fk";
--> statement-breakpoint
UPDATE "enrichment_cache"
SET "normalized" = jsonb_set("normalized", '{thumbnailImage}', "normalized" -> 'image') - 'image'
WHERE "normalized" ? 'image';
--> statement-breakpoint
UPDATE "enrichment_cache"
SET "normalized" = jsonb_set("normalized", '{captureImage}', "normalized" -> 'screenshot') - 'screenshot'
WHERE "normalized" ? 'screenshot';
