ALTER TABLE push_bindings
  ADD COLUMN reader_id text;

ALTER TABLE push_bindings
  ADD COLUMN preferences TEXT NOT NULL DEFAULT '{"content_post":true,"content_note":true,"content_recently":true,"comment_replied":true}' CHECK (json_valid(preferences));
