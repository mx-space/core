ALTER TABLE push_bindings
  ADD COLUMN IF NOT EXISTS reader_id text;

ALTER TABLE push_bindings
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"content_post":true,"content_note":true,"content_recently":true,"comment_replied":true}'::jsonb;
