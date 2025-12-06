-- D1 migration: Initial schema for purchase committee requests
CREATE TABLE IF NOT EXISTS Requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL,
  description TEXT NOT NULL,
  spec_file_url TEXT,
  estimated_cost REAL NOT NULL,
  five_year_cost REAL,
  prior_purchase INTEGER NOT NULL DEFAULT 0,
  prior_purchase_cost REAL,
  repeat_over_50k INTEGER NOT NULL DEFAULT 0,
  last_year_cost REAL,
  prev_year_cost REAL,
  using_existing_tender INTEGER NOT NULL DEFAULT 0,
  tender_number TEXT,
  tender_valid_until TEXT,
  tender_not_used_reason TEXT,
  no_additional_engagement INTEGER NOT NULL DEFAULT 1,
  all_costs_included INTEGER NOT NULL DEFAULT 1,
  has_electrical_works INTEGER NOT NULL DEFAULT 0,
  engineering_approval_name TEXT,
  engineering_approval_file_url TEXT,
  budget_account TEXT,
  cfo_approved INTEGER NOT NULL DEFAULT 0,
  additional_comments TEXT,
  requester_name TEXT,
  requester_position TEXT,
  signature_image_url TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON Requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_submitted_at ON Requests(submitted_at);
