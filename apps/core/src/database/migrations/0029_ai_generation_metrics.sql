-- Expand: durable per-generation usage/cost ledger for AI artifacts.
-- Contract (drop ai_translations.ai_model/ai_provider, ai_insights.model_info)
-- waits one release after writers stop using those columns (rolling deploy).
-- migration-lint:allow=no-bare-create-index reason=indexes target brand-new empty ai_generation_metrics table; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "ai_generation_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"ref_id" text NOT NULL,
	"lang" text,
	"task_id" text,
	"provider_id" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"total_tokens" integer,
	"cost_input_usd" double precision,
	"cost_output_usd" double precision,
	"cost_cache_read_usd" double precision,
	"cost_cache_write_usd" double precision,
	"cost_total_usd" double precision
);
--> statement-breakpoint
CREATE INDEX "ai_generation_metrics_resource_idx" ON "ai_generation_metrics" USING btree ("resource_type","resource_id","created_at");
--> statement-breakpoint
CREATE INDEX "ai_generation_metrics_ref_id_idx" ON "ai_generation_metrics" USING btree ("ref_id","created_at");
--> statement-breakpoint
INSERT INTO "ai_generation_metrics" (
  "id",
  "created_at",
  "resource_type",
  "resource_id",
  "ref_id",
  "lang",
  "provider_id",
  "model"
)
SELECT
  t."id" || ':metrics',
  t."created_at",
  'translation',
  t."id",
  t."ref_id",
  t."lang",
  t."ai_provider",
  t."ai_model"
FROM "ai_translations" t
WHERE t."ai_model" IS NOT NULL OR t."ai_provider" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "ai_generation_metrics" (
  "id",
  "created_at",
  "resource_type",
  "resource_id",
  "ref_id",
  "lang",
  "provider_id",
  "model"
)
SELECT
  i."id" || ':metrics',
  i."created_at",
  'insights',
  i."id",
  i."ref_id",
  i."lang",
  NULLIF(i."model_info"->>'provider', ''),
  NULLIF(i."model_info"->>'model', '')
FROM "ai_insights" i
WHERE i."model_info" IS NOT NULL
  AND i."model_info" <> 'null'::jsonb
  AND (
    NULLIF(i."model_info"->>'provider', '') IS NOT NULL
    OR NULLIF(i."model_info"->>'model', '') IS NOT NULL
  );
