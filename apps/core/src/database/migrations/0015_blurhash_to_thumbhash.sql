-- migration-lint:allow=no-drop-column reason=blurhash→thumbhash cutover in maintenance window
ALTER TABLE enrichment_captures DROP COLUMN blurhash;
--> statement-breakpoint
ALTER TABLE enrichment_captures ADD COLUMN thumbhash text;
--> statement-breakpoint
-- Strip dead `blurHash` keys from images jsonb on every content table.
-- COALESCE preserves `[]` (jsonb_agg returns NULL for an empty input set).
UPDATE posts SET images = COALESCE((
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
), '[]'::jsonb)
WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';
--> statement-breakpoint
UPDATE notes SET images = COALESCE((
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
), '[]'::jsonb)
WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';
--> statement-breakpoint
UPDATE pages SET images = COALESCE((
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
), '[]'::jsonb)
WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';
--> statement-breakpoint
UPDATE drafts SET images = COALESCE((
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
), '[]'::jsonb)
WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';
--> statement-breakpoint
-- enrichment_cache.normalized embeds the same blurhash strings under
-- `thumbnailImage.blurhash` and `captureImage.blurhash`. Strip both paths.
-- The `#-` operator removes a single nested key; null-safe by definition.
UPDATE enrichment_cache
SET normalized = (normalized #- '{thumbnailImage,blurhash}') #- '{captureImage,blurhash}'
WHERE normalized IS NOT NULL
  AND (normalized #> '{thumbnailImage,blurhash}' IS NOT NULL
    OR normalized #> '{captureImage,blurhash}' IS NOT NULL);
