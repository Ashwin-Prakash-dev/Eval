-- Bootstrap seed, replacing backend/seed.py. Workers has no startup hook, so this is
-- applied manually once per database:
--   npm run db:seed:local     (local dev database)
--   npm run db:seed:remote    (deployed database)
--
-- Change the address below to your own before running. No password is created: the
-- administrator signs in by requesting a one-time passcode, exactly like every other user.
-- Safe to re-run — the insert is ignored if the row already exists.
--
-- The rubric is no longer seeded. Criteria, their weights and the disagreement threshold
-- live in src/config/rubric.ts and ship with the Worker, so there is nothing to insert.

INSERT OR IGNORE INTO allowed_emails (email, role, full_name, note)
VALUES ('zakuzzdj@gmail.com', 'admin', 'Administrator', 'Bootstrap administrator');
