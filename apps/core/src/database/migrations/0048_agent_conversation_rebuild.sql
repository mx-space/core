-- migration-lint:allow=no-drop-table reason=agent conversations are disposable; owner approved discarding all data and a single-release rebuild
DROP TABLE IF EXISTS "ai_agent_conversations";--> statement-breakpoint
CREATE TABLE "ai_agent_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"model" text NOT NULL,
	"provider_id" text NOT NULL,
	"title" text,
	"transcript" json NOT NULL,
	"review_state" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);--> statement-breakpoint
-- migration-lint:allow=no-bare-create-index reason=index targets freshly created empty table; CONCURRENTLY would block creation inside the same migration transaction
CREATE INDEX "ai_agent_conversation_session_idx" ON "ai_agent_conversations" USING btree ("session_id");
