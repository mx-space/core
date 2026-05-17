-- migration-lint:allow=no-drop-column reason=recentlies enrichment columns were already removed by app migration 20260515; this Drizzle migration catches the schema ledger up
DROP INDEX IF EXISTS "recentlies_enrichment_idx";--> statement-breakpoint
CREATE INDEX CONCURRENTLY "notes_published_public_created_idx" ON "notes" USING btree ("is_published","created_at" DESC NULLS LAST,"public_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "posts_published_created_at_idx" ON "posts" USING btree ("is_published","pin_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "posts_category_published_created_idx" ON "posts" USING btree ("category_id","is_published","pin_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "posts_tags_gin_idx" ON "posts" USING gin ("tags");--> statement-breakpoint
ALTER TABLE "recentlies" DROP COLUMN IF EXISTS "enrichment_provider";--> statement-breakpoint
ALTER TABLE "recentlies" DROP COLUMN IF EXISTS "enrichment_external_id";
