-- Normalize legacy language keys stored by ai_summaries / ai_insights.
--
-- parseLanguageCode used to store the raw lowercased base segment of the
-- requested language ("jp", "cn", "jpn", ...). It now normalizes through
-- ~/utils/lang.util (jp -> ja, cn -> zh, ...), so rows stored under the old
-- alias keys became unreachable and would trigger duplicate paid
-- regeneration. This migration remaps stored keys to their canonical codes.
--
-- The mapping mirrors normalizeLanguageCode's alias tables, restricted to
-- single-segment keys: the old code stripped everything after the first "-"
-- or ",", so hyphenated aliases (zh-cn, en-us, ...) cannot exist in data.
--
-- ai_translations / translation_entries already normalized via lang.util at
-- write time and need no fixing.
--
-- Step 1: among rows that would collide on the canonical key, keep the
-- newest (created_at, then id) and delete the rest.
-- ai_summaries has no unique constraint on (ref_id, lang); its natural key
-- is (ref_id, lang, hash), so dedupe on that.
WITH lang_map(old_lang, new_lang) AS (
  VALUES
    ('cn', 'zh'), ('tw', 'zh'), ('jp', 'ja'), ('kr', 'ko'),
    ('iw', 'he'), ('in', 'id'), ('nb', 'no'), ('nn', 'no'),
    ('eng', 'en'), ('zho', 'zh'), ('chi', 'zh'), ('jpn', 'ja'),
    ('kor', 'ko'), ('fra', 'fr'), ('fre', 'fr'), ('deu', 'de'),
    ('ger', 'de'), ('spa', 'es'), ('por', 'pt'), ('rus', 'ru'),
    ('ita', 'it'), ('nld', 'nl'), ('dut', 'nl'), ('swe', 'sv'),
    ('dan', 'da'), ('fin', 'fi'), ('nor', 'no')
),
ranked AS (
  SELECT s."id",
         ROW_NUMBER() OVER (
           PARTITION BY s."ref_id", COALESCE(m.new_lang, s."lang"), s."hash"
           ORDER BY s."created_at" DESC, s."id" DESC
         ) AS rn
  FROM "ai_summaries" s
  LEFT JOIN lang_map m ON s."lang" = m.old_lang
  WHERE s."lang" IS NOT NULL
)
DELETE FROM "ai_summaries"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);
--> statement-breakpoint
WITH lang_map(old_lang, new_lang) AS (
  VALUES
    ('cn', 'zh'), ('tw', 'zh'), ('jp', 'ja'), ('kr', 'ko'),
    ('iw', 'he'), ('in', 'id'), ('nb', 'no'), ('nn', 'no'),
    ('eng', 'en'), ('zho', 'zh'), ('chi', 'zh'), ('jpn', 'ja'),
    ('kor', 'ko'), ('fra', 'fr'), ('fre', 'fr'), ('deu', 'de'),
    ('ger', 'de'), ('spa', 'es'), ('por', 'pt'), ('rus', 'ru'),
    ('ita', 'it'), ('nld', 'nl'), ('dut', 'nl'), ('swe', 'sv'),
    ('dan', 'da'), ('fin', 'fi'), ('nor', 'no')
)
UPDATE "ai_summaries"
SET "lang" = m.new_lang
FROM lang_map m
WHERE "ai_summaries"."lang" = m.old_lang;
--> statement-breakpoint
-- ai_insights has UNIQUE (ref_id, lang): dedupe on the canonical pair before
-- remapping. source_insights_id FK is ON DELETE SET NULL, so deletes are safe.
WITH lang_map(old_lang, new_lang) AS (
  VALUES
    ('cn', 'zh'), ('tw', 'zh'), ('jp', 'ja'), ('kr', 'ko'),
    ('iw', 'he'), ('in', 'id'), ('nb', 'no'), ('nn', 'no'),
    ('eng', 'en'), ('zho', 'zh'), ('chi', 'zh'), ('jpn', 'ja'),
    ('kor', 'ko'), ('fra', 'fr'), ('fre', 'fr'), ('deu', 'de'),
    ('ger', 'de'), ('spa', 'es'), ('por', 'pt'), ('rus', 'ru'),
    ('ita', 'it'), ('nld', 'nl'), ('dut', 'nl'), ('swe', 'sv'),
    ('dan', 'da'), ('fin', 'fi'), ('nor', 'no')
),
ranked AS (
  SELECT i."id",
         ROW_NUMBER() OVER (
           PARTITION BY i."ref_id", COALESCE(m.new_lang, i."lang")
           ORDER BY i."created_at" DESC, i."id" DESC
         ) AS rn
  FROM "ai_insights" i
  LEFT JOIN lang_map m ON i."lang" = m.old_lang
)
DELETE FROM "ai_insights"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);
--> statement-breakpoint
WITH lang_map(old_lang, new_lang) AS (
  VALUES
    ('cn', 'zh'), ('tw', 'zh'), ('jp', 'ja'), ('kr', 'ko'),
    ('iw', 'he'), ('in', 'id'), ('nb', 'no'), ('nn', 'no'),
    ('eng', 'en'), ('zho', 'zh'), ('chi', 'zh'), ('jpn', 'ja'),
    ('kor', 'ko'), ('fra', 'fr'), ('fre', 'fr'), ('deu', 'de'),
    ('ger', 'de'), ('spa', 'es'), ('por', 'pt'), ('rus', 'ru'),
    ('ita', 'it'), ('nld', 'nl'), ('dut', 'nl'), ('swe', 'sv'),
    ('dan', 'da'), ('fin', 'fi'), ('nor', 'no')
)
UPDATE "ai_insights"
SET "lang" = m.new_lang
FROM lang_map m
WHERE "ai_insights"."lang" = m.old_lang;
