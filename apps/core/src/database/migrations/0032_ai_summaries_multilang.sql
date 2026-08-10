ALTER TABLE "ai_summaries" ADD COLUMN "is_translation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "source_summary_id" text;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "source_lang" text;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_source_summary_id_ai_summaries_id_fk" FOREIGN KEY ("source_summary_id") REFERENCES "public"."ai_summaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "ai_summaries" SET "lang" = 'zh' WHERE "lang" IS NULL;--> statement-breakpoint
DELETE FROM "ai_summaries" a
USING "ai_summaries" b
WHERE a."ref_id" = b."ref_id"
	AND a."lang" = b."lang"
	AND (a."created_at" < b."created_at"
		OR (a."created_at" = b."created_at" AND a."id" < b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "ai_summaries_ref_lang_uniq" ON "ai_summaries" USING btree ("ref_id","lang");