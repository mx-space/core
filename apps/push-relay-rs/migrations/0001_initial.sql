CREATE TABLE IF NOT EXISTS push_installations (
  id text PRIMARY KEY NOT NULL,
  app_id text NOT NULL,
  apns_environment text NOT NULL CHECK (apns_environment IN ('development', 'production')),
  token_hash text NOT NULL,
  token_ciphertext text NOT NULL,
  secret_hash text NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  revoked_at INTEGER,
  CONSTRAINT push_installations_token_hash_hex CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT push_installations_secret_hash_hex CHECK (length(secret_hash) = 64 AND secret_hash NOT GLOB '*[^0-9a-f]*')
);
CREATE INDEX IF NOT EXISTS push_installations_token_idx
  ON push_installations (app_id, apns_environment, token_hash);

CREATE TABLE IF NOT EXISTS push_activation_tickets (
  id text PRIMARY KEY NOT NULL,
  ticket_hash text NOT NULL UNIQUE,
  installation_id text NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,
  claimed_at INTEGER,
  CONSTRAINT push_activation_tickets_hash_hex CHECK (length(ticket_hash) = 64 AND ticket_hash NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT push_activation_tickets_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS push_activation_tickets_expiry_idx
  ON push_activation_tickets (expires_at) WHERE claimed_at IS NULL;

CREATE TABLE IF NOT EXISTS push_sources (
  id text PRIMARY KEY NOT NULL,
  origin text NOT NULL,
  label text,
  secret_ciphertext text NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS push_bindings (
  id text PRIMARY KEY NOT NULL,
  source_id text NOT NULL REFERENCES push_sources(id) ON DELETE CASCADE,
  installation_id text NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  revoked_at INTEGER,
  UNIQUE (source_id, installation_id)
);
CREATE INDEX IF NOT EXISTS push_bindings_source_active_idx
  ON push_bindings (source_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS push_events (
  id text NOT NULL,
  source_id text NOT NULL REFERENCES push_sources(id) ON DELETE CASCADE,
  delivery_id text NOT NULL,
  event_type text NOT NULL,
  subject text NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  event_time INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (source_id, id)
);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id text PRIMARY KEY NOT NULL,
  source_id text NOT NULL,
  event_id text NOT NULL,
  binding_id text NOT NULL REFERENCES push_bindings(id) ON DELETE CASCADE,
  installation_id text NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retrying', 'delivered', 'failed')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_error text,
  apns_id text,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (source_id, event_id) REFERENCES push_events(source_id, id) ON DELETE CASCADE,
  UNIQUE (source_id, event_id, binding_id)
);
CREATE INDEX IF NOT EXISTS push_deliveries_pending_idx
  ON push_deliveries (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retrying');
