-- Existing bindings must be reactivated by a core that verifies owner authority.
ALTER TABLE push_bindings ADD COLUMN owner_authorized INTEGER NOT NULL DEFAULT 0 CHECK (owner_authorized IN (0, 1));
CREATE INDEX IF NOT EXISTS push_events_source_created_idx ON push_events (source_id, created_at);
CREATE INDEX IF NOT EXISTS push_events_created_idx ON push_events (created_at);
CREATE INDEX IF NOT EXISTS push_deliveries_created_idx ON push_deliveries (created_at);
CREATE INDEX IF NOT EXISTS push_installations_created_idx ON push_installations (created_at);
