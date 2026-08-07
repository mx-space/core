CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS push_installations (
  id text PRIMARY KEY,
  app_id text NOT NULL,
  apns_environment text NOT NULL CHECK (apns_environment IN ('development', 'production')),
  token_hash text NOT NULL,
  token_ciphertext text NOT NULL,
  secret_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT push_installations_token_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT push_installations_secret_hash_hex CHECK (secret_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS push_installations_token_idx
  ON push_installations (app_id, apns_environment, token_hash);

CREATE TABLE IF NOT EXISTS push_activation_tickets (
  id text PRIMARY KEY,
  ticket_hash text NOT NULL UNIQUE,
  installation_id text NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  CONSTRAINT push_activation_tickets_hash_hex CHECK (ticket_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT push_activation_tickets_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS push_activation_tickets_expiry_idx
  ON push_activation_tickets (expires_at) WHERE claimed_at IS NULL;

CREATE TABLE IF NOT EXISTS push_sources (
  id text PRIMARY KEY,
  origin text NOT NULL,
  label text,
  secret_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS push_bindings (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES push_sources(id) ON DELETE CASCADE,
  installation_id text NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
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
  payload jsonb NOT NULL,
  event_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, id)
);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id text PRIMARY KEY,
  source_id text NOT NULL,
  event_id text NOT NULL,
  binding_id text NOT NULL REFERENCES push_bindings(id) ON DELETE CASCADE,
  installation_id text NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retrying', 'delivered', 'failed')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  apns_id text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_id, event_id) REFERENCES push_events(source_id, id) ON DELETE CASCADE,
  UNIQUE (source_id, event_id, binding_id)
);
CREATE INDEX IF NOT EXISTS push_deliveries_pending_idx
  ON push_deliveries (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retrying');
