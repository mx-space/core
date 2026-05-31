-- Add nullable `title` column for LLM-derived conversation titles.
-- Expand-only (§C.1) — old code does not reference the column, safe for rolling deploy.
ALTER TABLE "ai_agent_conversations" ADD COLUMN "title" text;
