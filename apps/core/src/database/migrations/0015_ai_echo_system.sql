-- migration-lint:allow=no-bare-create-index reason=ai_echoes, ai_memories, corpus_embeddings, persona_profiles are brand-new tables, empty at deploy time
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "ai_echoes" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_key" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"persona_key" text NOT NULL,
	"content" text,
	"status" text NOT NULL,
	"model" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"edited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"salience" real DEFAULT 1 NOT NULL,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector,
	"embedding_model" text,
	"dim" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"supersedes_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "corpus_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector NOT NULL,
	"embedding_model" text NOT NULL,
	"dim" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_key" text NOT NULL,
	"profile" text NOT NULL,
	"profile_summary" text,
	"corpus_version" integer NOT NULL,
	"distill_model" text NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL,
	"auto_next_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "persona_profiles_persona_key_unique" UNIQUE("persona_key")
);
--> statement-breakpoint
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_supersedes_id_ai_memories_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."ai_memories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_echoes_subject_idx" ON "ai_echoes" USING btree ("scenario_key","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "ai_echoes_status_idx" ON "ai_echoes" USING btree ("scenario_key","status");--> statement-breakpoint
CREATE INDEX "ai_echoes_persona_subject_idx" ON "ai_echoes" USING btree ("subject_type","subject_id","persona_key");--> statement-breakpoint
CREATE INDEX "ai_memories_scope_status_idx" ON "ai_memories" USING btree ("scope","status");--> statement-breakpoint
CREATE INDEX "ai_memories_active_idx" ON "ai_memories" USING btree ("status") WHERE "ai_memories"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "corpus_embeddings_source_chunk_model_uniq" ON "corpus_embeddings" USING btree ("source_type","source_id","chunk_index","embedding_model");--> statement-breakpoint
CREATE INDEX "corpus_embeddings_source_idx" ON "corpus_embeddings" USING btree ("source_type","source_id");