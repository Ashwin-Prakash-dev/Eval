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
