-- Multilingual BM25 search index: per-language search documents.
-- Existing rows are source-language documents; backfill lang='zh' (the default
-- source language) then drop the default so future inserts must specify lang.
-- search_documents is a small table (≈ row count of articles); non-concurrent
-- DDL locks for milliseconds. Drizzle migrator wraps each migration in a
-- transaction, so CONCURRENTLY is unavailable here.
ALTER TABLE "search_documents" ADD COLUMN "lang" text NOT NULL DEFAULT 'zh';--> statement-breakpoint
ALTER TABLE "search_documents" ALTER COLUMN "lang" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "search_documents" ADD COLUMN "source_hash" text NOT NULL DEFAULT '';--> statement-breakpoint
DROP INDEX IF EXISTS "search_documents_ref_uniq";--> statement-breakpoint
-- migration-lint:allow=no-bare-create-index reason=search_documents is small (≈ article count); non-concurrent index swap locks only milliseconds. Drizzle migrator wraps each migration in a transaction so CONCURRENTLY isn't usable here.
CREATE UNIQUE INDEX IF NOT EXISTS "search_documents_ref_lang_uniq" ON "search_documents" USING btree ("ref_type","ref_id","lang");--> statement-breakpoint
-- migration-lint:allow=no-bare-create-index reason=search_documents is small (≈ article count); non-concurrent index creation locks only milliseconds. Drizzle migrator wraps each migration in a transaction so CONCURRENTLY isn't usable here.
CREATE INDEX IF NOT EXISTS "search_documents_lang_idx" ON "search_documents" USING btree ("lang");
