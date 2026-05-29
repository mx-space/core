-- Destructive rewrite of ai_agent_conversations approved by spec
-- docs/superpowers/specs/2026-05-30-ai-sdk-migration-to-pi-design.md; admin chat
-- tolerates <=5min downtime during pre-deploy migration (Dokploy 2-replica window).
-- New table replaces refId/refType/title/reviewState/diffState/messageCount with
-- a session_id column; pi-native Message[] is stored unchanged in jsonb.
-- migration-lint:allow=no-bare-create-index reason=index targets freshly created empty table; CONCURRENTLY would block creation inside the same migration transaction
DROP TABLE IF EXISTS "ai_agent_conversations";--> statement-breakpoint
CREATE TABLE "ai_agent_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"model" text,
	"provider_id" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX "ai_agent_conversation_session_idx" ON "ai_agent_conversations" USING btree ("session_id");
