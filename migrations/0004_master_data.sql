-- Master data for budget officers, procurement, and committee coordinator (for future workflow)
CREATE TABLE IF NOT EXISTS budget_officers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT
);

CREATE TABLE IF NOT EXISTS procurement_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS committee_coordinators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL
);

INSERT INTO budget_officers (name, email) VALUES
  ('מינהל רווחה וכספים', NULL),
  ('מינהל כללי', NULL),
  ('מנהל תפעול', NULL),
  ('מינהל חינוך', NULL),
  ('מינהל הסכמי גג', NULL),
  ('מינהל הנדסה', NULL),
  ('מינהל טסט', 'yaniv@ashdod.muni.il');

INSERT INTO procurement_users (name, email) VALUES
  ('רכש ראשי', 'yaniv@ashdod.muni.il');

INSERT INTO committee_coordinators (name, email) VALUES
  ('רכזת הועדה', 'yaniv@ashdod.muni.il');
