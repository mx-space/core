-- migration-lint:allow=no-bare-create-index reason=indexes target brand-new empty ai_tts tables; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "ai_tts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"ref_id" text NOT NULL,
	"lang" text NOT NULL,
	"is_translation" boolean DEFAULT false NOT NULL,
	"source_lang" text,
	"model" text NOT NULL,
	"voice" text NOT NULL,
	"speed" real DEFAULT 1 NOT NULL,
	"format" text DEFAULT 'mp3' NOT NULL,
	"block_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer,
	"source_modified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_tts_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tts_id" text NOT NULL,
	"block_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"url" text NOT NULL,
	"storage_backend" text NOT NULL,
	"storage_key" text NOT NULL,
	"byte_size" integer,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "ai_tts_blocks" ADD CONSTRAINT "ai_tts_blocks_tts_id_ai_tts_id_fk" FOREIGN KEY ("tts_id") REFERENCES "public"."ai_tts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_tts_ref_lang_uniq" ON "ai_tts" USING btree ("ref_id","lang");
--> statement-breakpoint
CREATE INDEX "ai_tts_ref_id_idx" ON "ai_tts" USING btree ("ref_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_tts_blocks_key_uniq" ON "ai_tts_blocks" USING btree ("tts_id","block_id","chunk_index");
--> statement-breakpoint
CREATE INDEX "ai_tts_blocks_tts_id_idx" ON "ai_tts_blocks" USING btree ("tts_id");
