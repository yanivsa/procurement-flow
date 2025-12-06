-- Add attachments metadata and status log tables to track file blobs and workflow history
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  kind TEXT NOT NULL, -- e.g., spec, engineering, signature
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES Requests(id)
);

CREATE INDEX IF NOT EXISTS idx_attachments_request ON attachments(request_id);

CREATE TABLE IF NOT EXISTS status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES Requests(id)
);

CREATE INDEX IF NOT EXISTS idx_status_log_request ON status_log(request_id);
CREATE INDEX IF NOT EXISTS idx_status_log_created ON status_log(created_at);
