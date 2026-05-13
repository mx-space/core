-- migration-lint:allow=no-bare-create-index reason=enrichment_screenshots is a brand-new table, empty at deploy time
CREATE TABLE IF NOT EXISTS "enrichment_screenshots" (
	"enrichment_id" text PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"blurhash" text,
	"palette" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrichment_screenshots_enrichment_id_enrichment_cache_id_fk" FOREIGN KEY ("enrichment_id") REFERENCES "public"."enrichment_cache"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrichment_screenshots_lru_idx" ON "enrichment_screenshots" USING btree ("last_accessed_at");