ALTER TABLE "file_references" ADD COLUMN IF NOT EXISTS "asset_key" text;--> statement-breakpoint
ALTER TABLE "file_references" ADD COLUMN IF NOT EXISTS "draft_id" text;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "file_references_asset_key_idx" ON "file_references" USING btree ("asset_key");
