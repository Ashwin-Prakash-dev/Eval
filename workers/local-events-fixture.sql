-- Local development fixture for the STARTATHON event database (the EVENTS_DB binding).
--
-- The real tables are owned by scc-api-worker (migrations/events/0015 and 0027). This file
-- recreates just enough of them, plus a few sample rows, so this app can be run locally
-- without a copy of that system.
--
-- LOCAL ONLY. Never apply this to the remote database: the startathon deployment owns that
-- schema, and this app only ever reads it.
--
--   npm run db:events:local
--
-- The `status` on every team is 'confirmed' because an application row can only exist for a
-- confirmed team (putApplication.ts guards with unconfirmedTeamBlock), so nothing here needs
-- to model the payment-pending case.

CREATE TABLE IF NOT EXISTS startathon_teams (
  team_id         TEXT PRIMARY KEY,
  team_name       TEXT NOT NULL UNIQUE,
  leader_id       TEXT NOT NULL,
  join_code       TEXT NOT NULL UNIQUE,
  transaction_ref TEXT,
  status          TEXT NOT NULL DEFAULT 'payment-pending',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);

CREATE TABLE IF NOT EXISTS startathon_applications (
  team_id          TEXT PRIMARY KEY REFERENCES startathon_teams(team_id),
  title            TEXT NOT NULL,
  summary          TEXT NOT NULL,
  problem_evidence TEXT NOT NULL,
  deck_url         TEXT NOT NULL,
  video_url        TEXT NOT NULL,
  prior_work       TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER,
  domains          TEXT
);

-- The team roster. Membership is a column here, not a join table, so "everyone on team X"
-- is `WHERE team_id = 'X'`. Only `name` and `role` are ever read by this app -- the
-- remaining columns exist so the fixture matches the real shape, not because anything here
-- selects them.
CREATE TABLE IF NOT EXISTS startathon_users (
  user_id       TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  team_id       TEXT REFERENCES startathon_teams(team_id),
  role          TEXT CHECK (role IN ('leader', 'member')),
  created_at    INTEGER NOT NULL,
  gender        TEXT
);

-- Per-member application detail. A member who wrote nothing has NO ROW here, which is why
-- every read is a LEFT JOIN from startathon_users -- see membersByTeamIds.
CREATE TABLE IF NOT EXISTS startathon_application_members (
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  user_id       TEXT NOT NULL REFERENCES startathon_users(user_id),
  about         TEXT,
  resume_url    TEXT,
  github        TEXT,
  linkedin      TEXT,
  project_links TEXT,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

DELETE FROM startathon_application_members;
DELETE FROM startathon_users;
DELETE FROM startathon_applications;
DELETE FROM startathon_teams;

INSERT INTO startathon_teams (team_id, team_name, leader_id, join_code, status, created_at)
VALUES
  ('team_001', 'Team Flapjack',            'user_001', 'JOIN001', 'confirmed', 1754870001),
  ('team_002', 'The Moist Owls',           'user_002', 'JOIN002', 'confirmed', 1754870002),
  ('team_003', 'Nacho Enthusiasts',        'user_003', 'JOIN003', 'confirmed', 1754870003),
  ('team_004', 'Data Goblins',             'user_004', 'JOIN004', 'confirmed', 1754870004),
  ('team_005', 'Kitchen Chaos Collective', 'user_005', 'JOIN005', 'confirmed', 1754870005);

-- domains / prior_work deliberately cover all three states: a populated JSON array, an empty
-- array (explicitly declared none), and NULL (never answered). The UI renders those three
-- differently and the distinction is easy to regress.
INSERT INTO startathon_applications
  (team_id, title, summary, problem_evidence, deck_url, video_url, prior_work, domains,
   created_at, updated_at)
VALUES
  ('team_001', 'Quantum Toaster',
   'A toaster that browns bread using quantum tunneling.',
   'Surveyed 40 students; 32 reported burning toast at least weekly.',
   'https://drive.google.com/file/d/deck001/view',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   '[{"kind":"prototype","url":"https://github.com/example/toaster","description":"Breadboard prototype from a prior event."}]',
   '["Sustainability"]', 1754870001, NULL),

  ('team_002', 'EchoMood',
   'Guesses your mood from the way you sigh into your microphone.',
   'Interviewed 12 counsellors who track mood manually on paper.',
   'https://drive.google.com/file/d/deck002/view',
   'https://www.youtube.com/watch?v=9bZkp7q19f0',
   '[]', '["Healthcare","Wellness"]', 1754870002, 1754880002),

  ('team_003', 'Blorptrack',
   'Supply-chain tracking for artisanal nacho cheese.',
   'Three local vendors lose stock monthly with no audit trail.',
   'https://drive.google.com/file/d/deck003/view',
   'https://www.youtube.com/watch?v=jNQXAC9IVRw',
   NULL, '["Fintech"]', 1754870003, NULL),

  ('team_004', 'Gibberlytics',
   'Real-time analytics dashboard, with very nice charts.',
   'Existing dashboards were rated unusable by 7 of 9 pilot users.',
   'https://drive.google.com/file/d/deck004/view',
   'https://www.youtube.com/watch?v=L_jWHffIx5E',
   '[]', '[]', 1754870004, NULL),

  ('team_005', 'Passive Aggressive Fridge',
   'Smart fridge that leaves guilt trips about expired yogurt.',
   'Household food waste logs collected over four weeks.',
   'https://drive.google.com/file/d/deck005/view',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   '[{"kind":"course-project","description":"Built a simpler version for a class, no code reused."}]',
   NULL, 1754870005, NULL);

-- Rosters. Team sizes vary on purpose, and team_002 is the interesting one: four members of
-- whom only two wrote anything. An INNER JOIN would render it as a two-person team, so this
-- is the row that catches that regression.
--
-- user_010 has a NULL name (signed up via Google and never completed a profile), which the
-- UI has to label rather than render as a blank line.
INSERT INTO startathon_users (user_id, name, email, phone, college, team_id, role, created_at)
VALUES
  ('user_001', 'Anita Raghavan',  'anita@example.com',  '9000000001', 'SCT', 'team_001', 'leader', 1754860001),
  ('user_006', 'Vikram Shenoy',   'vikram@example.com', '9000000006', 'SCT', 'team_001', 'member', 1754860006),

  ('user_002', 'Deepa Nair',      'deepa@example.com',  '9000000002', 'SCT', 'team_002', 'leader', 1754860002),
  ('user_007', 'Joel Mathew',     'joel@example.com',   '9000000007', 'SCT', 'team_002', 'member', 1754860007),
  ('user_008', 'Sneha Pillai',    'sneha@example.com',  '9000000008', 'SCT', 'team_002', 'member', 1754860008),
  ('user_009', 'Arjun Menon',     'arjun@example.com',  '9000000009', 'SCT', 'team_002', 'member', 1754860009),

  ('user_003', 'Farah Rasheed',   'farah@example.com',  '9000000003', 'SCT', 'team_003', 'leader', 1754860003),
  ('user_010', NULL,              'ghost@example.com',  NULL,         NULL,  'team_003', 'member', 1754860010),

  ('user_004', 'Rohit Varma',     'rohit@example.com',  '9000000004', 'SCT', 'team_004', 'leader', 1754860004),

  ('user_005', 'Latha Krishnan',  'latha@example.com',  '9000000005', 'SCT', 'team_005', 'leader', 1754860005);

-- project_links covers the same three states as domains/prior_work: populated, explicitly
-- empty, and never answered. team_004's leader has a row with every field NULL -- they
-- opened the form and saved it blank, which is NOT the same as never having a row, and the
-- serializer reports it as provided_details: true.
INSERT INTO startathon_application_members
  (team_id, user_id, about, resume_url, github, linkedin, project_links, updated_at)
VALUES
  ('team_001', 'user_001',
   'Final-year EEE, builds toasters for fun.',
   'https://drive.google.com/file/d/resume001/view',
   'https://github.com/anitar', 'https://linkedin.com/in/anitar',
   '["https://github.com/anitar/toaster","https://anitar.dev"]', 1754870101),

  ('team_001', 'user_006',
   'Firmware, mostly C.',
   'https://drive.google.com/file/d/resume006/view',
   'https://github.com/vikramsh', NULL,
   '[]', 1754870106),

  -- Only two of team_002's four members filled anything in.
  ('team_002', 'user_002',
   'Signal processing, some ML.',
   'https://drive.google.com/file/d/resume002/view',
   'https://github.com/deepan', 'https://linkedin.com/in/deepan',
   NULL, 1754870102),

  ('team_002', 'user_007',
   NULL, NULL,
   'https://github.com/joelm', NULL,
   NULL, 1754870107),

  ('team_003', 'user_003',
   'Supply chain nerd.',
   'https://drive.google.com/file/d/resume003/view',
   NULL, 'https://linkedin.com/in/farahr',
   '["https://farah.example.com/case-study"]', 1754870103),

  -- Saved the form with nothing in it: a row exists, all fields NULL.
  ('team_004', 'user_004', NULL, NULL, NULL, NULL, NULL, 1754870104);
