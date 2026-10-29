-- Data-only: rewrite stored language codes to canonical BCP 47 language-REGION
-- tags (zh -> zh-CN, tw -> zh-TW, en -> en-US). Idempotent; release N+1 reruns
-- it under a new number to sweep rows old pods wrote during the rolling deploy.
-- The map was generated with @mx-space/ai canonicalizeLanguageTag over every
-- code the previous release could store, plus identity rows for canonical
-- tags. Keys are lowercase and matched against lower(value). Unmapped values
-- stay as they are and are reported via RAISE NOTICE. No down migration: the
-- reverse mapping would merge zh-CN and zh-TW.
CREATE TEMP TABLE IF NOT EXISTS lang_tag_map (
  old_lang text PRIMARY KEY,
  new_lang text NOT NULL
) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO lang_tag_map (old_lang, new_lang) VALUES
  ('ar', 'ar-EG'),
  ('ar-eg', 'ar-EG'),
  ('bg', 'bg-BG'),
  ('bg-bg', 'bg-BG'),
  ('chi', 'zh-CN'),
  ('cn', 'zh-CN'),
  ('cs', 'cs-CZ'),
  ('cs-cz', 'cs-CZ'),
  ('da', 'da-DK'),
  ('da-dk', 'da-DK'),
  ('dan', 'da-DK'),
  ('de', 'de-DE'),
  ('de-de', 'de-DE'),
  ('deu', 'de-DE'),
  ('dut', 'nl-NL'),
  ('el', 'el-GR'),
  ('el-gr', 'el-GR'),
  ('en', 'en-US'),
  ('en-au', 'en-AU'),
  ('en-ca', 'en-CA'),
  ('en-gb', 'en-GB'),
  ('en-ie', 'en-IE'),
  ('en-nz', 'en-NZ'),
  ('en-us', 'en-US'),
  ('en-za', 'en-ZA'),
  ('eng', 'en-US'),
  ('es', 'es-ES'),
  ('es-419', 'es-419'),
  ('es-es', 'es-ES'),
  ('es-mx', 'es-MX'),
  ('et', 'et-EE'),
  ('et-ee', 'et-EE'),
  ('fa', 'fa-IR'),
  ('fa-ir', 'fa-IR'),
  ('fi', 'fi-FI'),
  ('fi-fi', 'fi-FI'),
  ('fil-ph', 'fil-PH'),
  ('fin', 'fi-FI'),
  ('fr', 'fr-FR'),
  ('fr-ca', 'fr-CA'),
  ('fr-fr', 'fr-FR'),
  ('fra', 'fr-FR'),
  ('fre', 'fr-FR'),
  ('ger', 'de-DE'),
  ('he', 'he-IL'),
  ('he-il', 'he-IL'),
  ('hi', 'hi-IN'),
  ('hi-in', 'hi-IN'),
  ('hr', 'hr-HR'),
  ('hr-hr', 'hr-HR'),
  ('hu', 'hu-HU'),
  ('hu-hu', 'hu-HU'),
  ('id', 'id-ID'),
  ('id-id', 'id-ID'),
  ('in', 'id-ID'),
  ('is', 'is-IS'),
  ('is-is', 'is-IS'),
  ('it', 'it-IT'),
  ('it-it', 'it-IT'),
  ('ita', 'it-IT'),
  ('iw', 'he-IL'),
  ('ja', 'ja-JP'),
  ('ja-jp', 'ja-JP'),
  ('jp', 'ja-JP'),
  ('jpn', 'ja-JP'),
  ('ko', 'ko-KR'),
  ('ko-kr', 'ko-KR'),
  ('kor', 'ko-KR'),
  ('kr', 'ko-KR'),
  ('lt', 'lt-LT'),
  ('lt-lt', 'lt-LT'),
  ('lv', 'lv-LV'),
  ('lv-lv', 'lv-LV'),
  ('ms', 'ms-MY'),
  ('ms-my', 'ms-MY'),
  ('nb', 'nb-NO'),
  ('nb-no', 'nb-NO'),
  ('nl', 'nl-NL'),
  ('nl-nl', 'nl-NL'),
  ('nld', 'nl-NL'),
  ('nn', 'nn-NO'),
  ('nn-no', 'nn-NO'),
  ('no', 'no-NO'),
  ('no-no', 'no-NO'),
  ('nor', 'no-NO'),
  ('pl', 'pl-PL'),
  ('pl-pl', 'pl-PL'),
  ('por', 'pt-BR'),
  ('pt', 'pt-BR'),
  ('pt-br', 'pt-BR'),
  ('pt-pt', 'pt-PT'),
  ('ro', 'ro-RO'),
  ('ro-ro', 'ro-RO'),
  ('ru', 'ru-RU'),
  ('ru-ru', 'ru-RU'),
  ('rus', 'ru-RU'),
  ('sk', 'sk-SK'),
  ('sk-sk', 'sk-SK'),
  ('sl', 'sl-SI'),
  ('sl-si', 'sl-SI'),
  ('spa', 'es-ES'),
  ('sr', 'sr-RS'),
  ('sr-cyrl', 'sr-RS'),
  ('sr-latn', 'sr-RS'),
  ('sr-rs', 'sr-RS'),
  ('sv', 'sv-SE'),
  ('sv-se', 'sv-SE'),
  ('sw', 'sw-TZ'),
  ('sw-tz', 'sw-TZ'),
  ('swe', 'sv-SE'),
  ('th', 'th-TH'),
  ('th-th', 'th-TH'),
  ('tl', 'fil-PH'),
  ('tr', 'tr-TR'),
  ('tr-tr', 'tr-TR'),
  ('tw', 'zh-TW'),
  ('uk', 'uk-UA'),
  ('uk-ua', 'uk-UA'),
  ('ur', 'ur-PK'),
  ('ur-pk', 'ur-PK'),
  ('vi', 'vi-VN'),
  ('vi-vn', 'vi-VN'),
  ('zh', 'zh-CN'),
  ('zh-cn', 'zh-CN'),
  ('zh-hans', 'zh-CN'),
  ('zh-hant', 'zh-TW'),
  ('zh-hk', 'zh-HK'),
  ('zh-mo', 'zh-MO'),
  ('zh-my', 'zh-MY'),
  ('zh-sg', 'zh-SG'),
  ('zh-tw', 'zh-TW'),
  ('zho', 'zh-CN')

ON CONFLICT (old_lang) DO NOTHING;
--> statement-breakpoint
-- Unique indexes cover (natural key, lang): among rows that collapse onto the
-- same canonical tag keep the most recently written one, then delete the rest
-- before the UPDATE. ai_translations are re-translated in place, so their
-- recency is updated_at, not created_at. ai_tts_blocks cascade; source_*_id
-- FKs are ON DELETE SET NULL.
DO $$
DECLARE
  target record;
  unmapped text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('ai_translations', 'lang', 'ref_id, ref_type', 'COALESCE(t.updated_at, t.created_at)'),
      ('ai_translations', 'source_lang', NULL, NULL),
      ('ai_summaries', 'lang', 'ref_id', 't.created_at'),
      ('ai_summaries', 'source_lang', NULL, NULL),
      ('ai_insights', 'lang', 'ref_id', 't.created_at'),
      ('ai_insights', 'source_lang', NULL, NULL),
      ('ai_tts', 'lang', 'ref_id', 't.created_at'),
      ('ai_tts', 'source_lang', NULL, NULL),
      ('translation_entries', 'lang', 'key_path, key_type, lookup_key', 't.created_at'),
      ('search_documents', 'lang', 'ref_type, ref_id', 't.created_at'),
      ('ai_generation_metrics', 'lang', NULL, NULL)
    ) AS t(table_name, column_name, partition_columns, recency)
  LOOP
    EXECUTE format(
      'SELECT string_agg(DISTINCT t.%1$I, '', '') FROM %2$I t
       WHERE t.%1$I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM lang_tag_map m WHERE m.old_lang = lower(t.%1$I))',
      target.column_name, target.table_name
    ) INTO unmapped;
    IF unmapped IS NOT NULL THEN
      RAISE NOTICE 'language_tag_bcp47: unmapped %.%: %',
        target.table_name, target.column_name, unmapped;
    END IF;

    IF target.partition_columns IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM %2$I WHERE id IN (
           SELECT id FROM (
             SELECT t.id, ROW_NUMBER() OVER (
               PARTITION BY %3$s, COALESCE(m.new_lang, t.%1$I)
               ORDER BY %4$s DESC, t.id DESC
             ) AS rn
             FROM %2$I t
             LEFT JOIN lang_tag_map m ON m.old_lang = lower(t.%1$I)
             WHERE t.%1$I IS NOT NULL
           ) ranked
           WHERE rn > 1
         )',
        target.column_name, target.table_name, target.partition_columns,
        target.recency
      );
    END IF;

    EXECUTE format(
      'UPDATE %2$I t SET %1$I = m.new_lang
       FROM lang_tag_map m
       WHERE m.old_lang = lower(t.%1$I) AND t.%1$I <> m.new_lang',
      target.column_name, target.table_name
    );
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  target record;
  unmapped text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('posts', 'meta'),
      ('notes', 'meta'),
      ('pages', 'meta'),
      ('content_revisions', 'meta'),
      ('comments', 'anchor')
    ) AS t(table_name, column_name)
  LOOP
    EXECUTE format(
      'SELECT string_agg(DISTINCT t.%1$I->>''lang'', '', '') FROM %2$I t
       WHERE jsonb_typeof(t.%1$I->''lang'') = ''string''
         AND NOT EXISTS (
           SELECT 1 FROM lang_tag_map m WHERE m.old_lang = lower(t.%1$I->>''lang'')
         )',
      target.column_name, target.table_name
    ) INTO unmapped;
    IF unmapped IS NOT NULL THEN
      RAISE NOTICE 'language_tag_bcp47: unmapped %.%.lang: %',
        target.table_name, target.column_name, unmapped;
    END IF;

    EXECUTE format(
      'UPDATE %2$I t SET %1$I = jsonb_set(t.%1$I, ''{lang}'', to_jsonb(m.new_lang))
       FROM lang_tag_map m
       WHERE jsonb_typeof(t.%1$I->''lang'') = ''string''
         AND m.old_lang = lower(t.%1$I->>''lang'')
         AND t.%1$I->>''lang'' <> m.new_lang',
      target.column_name, target.table_name
    );
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  setting_key text;
  unmapped text;
BEGIN
  FOREACH setting_key IN ARRAY ARRAY[
    'summaryTargetLanguages',
    'translationTargetLanguages',
    'insightsTargetLanguages'
  ]
  LOOP
    SELECT string_agg(DISTINCT e.value, ', ') INTO unmapped
    FROM options o
    CROSS JOIN LATERAL jsonb_array_elements_text(o.value->setting_key) e
    WHERE o.name = 'ai'
      AND jsonb_typeof(o.value->setting_key) = 'array'
      AND NOT EXISTS (SELECT 1 FROM lang_tag_map m WHERE m.old_lang = lower(e.value));
    IF unmapped IS NOT NULL THEN
      RAISE NOTICE 'language_tag_bcp47: unmapped options.ai.%: %', setting_key, unmapped;
    END IF;

    UPDATE options o
    SET value = jsonb_set(
      o.value,
      ARRAY[setting_key],
      COALESCE(
        (
          SELECT jsonb_agg(deduped.tag ORDER BY deduped.first_position)
          FROM (
            SELECT COALESCE(m.new_lang, e.value) AS tag, min(e.position) AS first_position
            FROM jsonb_array_elements_text(o.value->setting_key) WITH ORDINALITY AS e(value, position)
            LEFT JOIN lang_tag_map m ON m.old_lang = lower(e.value)
            GROUP BY 1
          ) deduped
        ),
        '[]'::jsonb
      )
    )
    WHERE o.name = 'ai' AND jsonb_typeof(o.value->setting_key) = 'array';
  END LOOP;
END $$;
