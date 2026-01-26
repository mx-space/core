-- Telemetry data table
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  version TEXT NOT NULL,
  node_version TEXT,
  event TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instance_id ON telemetry(instance_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON telemetry(created_at);
CREATE INDEX IF NOT EXISTS idx_version ON telemetry(version);
