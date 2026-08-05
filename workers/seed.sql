-- Bootstrap seed, replacing backend/seed.py. Workers has no startup hook, so this is
-- applied manually once per database:
--   npm run db:seed:local     (local dev database)
--   npm run db:seed:remote    (deployed database)
--
-- Change the address below to your own before running. No password is created: the
-- administrator signs in by requesting a one-time passcode, exactly like every other user.
-- Safe to re-run — both inserts are ignored if the row already exists.

INSERT OR IGNORE INTO allowed_emails (email, role, full_name, note)
VALUES ('ashwinprk.dev@gmail.com', 'admin', 'Administrator', 'Bootstrap administrator');

INSERT OR IGNORE INTO rubrics (id, name, is_active, disagreement_threshold)
VALUES (1, 'Default Rubric', 1, 1.5);

INSERT OR IGNORE INTO evaluation_criteria (rubric_id, name, description, weight, order_index)
VALUES
  (1, 'Innovation',      'Originality and creativity of the idea',              30, 0),
  (1, 'Technical Depth', 'Quality and sophistication of the implementation',    25, 1),
  (1, 'Feasibility',     'Practicality of building and shipping this solution', 20, 2),
  (1, 'Impact',          'Potential real-world impact and reach',               15, 3),
  (1, 'Presentation',    'Clarity and persuasiveness of the pitch',             10, 4);
