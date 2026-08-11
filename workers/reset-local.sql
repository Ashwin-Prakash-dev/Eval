-- Wipes all data from the LOCAL development database, keeping the schema.
-- Run `npm run db:seed:local` afterwards to restore the bootstrap admin.
--
-- The rubric is not stored in the database (see src/config/rubric.ts), so there is
-- nothing rubric-related to clear here.
DELETE FROM evaluation_scores;
DELETE FROM comments;
DELETE FROM evaluations;
DELETE FROM submission_scores;
DELETE FROM audit_logs;
DELETE FROM otp_codes;
DELETE FROM allowed_emails;
DELETE FROM users;
