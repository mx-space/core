CREATE TABLE "enrichment_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" varchar(64) NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"url" text NOT NULL,
	"normalized" jsonb NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recentlies" ADD COLUMN "enrichment_provider" varchar(64);--> statement-breakpoint
ALTER TABLE "recentlies" ADD COLUMN "enrichment_external_id" varchar(256);--> statement-breakpoint
CREATE UNIQUE INDEX "enrichment_provider_external_id_uniq" ON "enrichment_cache" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "enrichment_expires_at_idx" ON "enrichment_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "recentlies_enrichment_idx" ON "recentlies" USING btree ("enrichment_provider","enrichment_external_id");--> statement-breakpoint
-- Migrate old flat thirdPartyServiceIntegration to new nested shape
UPDATE options
SET value = jsonb_set(
  value - 'githubToken',
  '{github}',
  jsonb_build_object(
    'enabled', true,
    'token', COALESCE(value -> 'githubToken', '""'::jsonb)
  )
)
WHERE name = 'thirdPartyServiceIntegration'
  AND value ? 'githubToken'
  AND NOT (value ? 'github');