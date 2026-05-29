-- Collapse legacy AIProviderType values into the reduced 3-value enum.
--
-- mx-core stores AI provider config as JSON inside the `options` table
-- (row name='ai'), not as a dedicated `ai_providers` table with a
-- Postgres pgEnum. The TypeScript `AIProviderType` enum has been
-- reduced from {openai, openai-compatible, anthropic, openrouter} to
-- {openai-compatible, anthropic, generic}. This migration rewrites
-- stored config so existing providers parse against the new enum:
--
--   'openai'     -> 'openai-compatible' (legacy OpenAI providers retain
--                   their endpoint; api.openai.com is the default for
--                   openai-compatible runtimes).
--   'openrouter' -> 'openai-compatible' (OpenRouter is an OpenAI-compat
--                   completions endpoint; the stored endpoint preserves
--                   the routing target).
--
-- The new `contextWindow` / `maxTokens` fields are additive optional
-- properties on AIProviderConfig; storage is jsonb so no DDL is needed
-- to make room for them — null/undefined surfaces as a registry-driven
-- default at runtime.
UPDATE "options"
SET "value" = jsonb_set(
  "value",
  '{providers}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN provider->>'type' IN ('openai', 'openrouter')
            THEN jsonb_set(provider, '{type}', '"openai-compatible"'::jsonb)
          ELSE provider
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements("value"->'providers') AS provider
  )
)
WHERE "name" = 'ai'
  AND jsonb_typeof("value"->'providers') = 'array';
