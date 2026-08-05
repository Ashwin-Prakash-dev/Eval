-- Wipes all data from the LOCAL development database, keeping the schema.
-- Run `npm run db:seed:local` afterwards to restore the bootstrap admin and rubric.
DELETE FROM evaluation_scores;
DELETE FROM comments;
DELETE FROM evaluations;
DELETE FROM submission_scores;
DELETE FROM assignments;
DELETE FROM conflict_exclusions;
DELETE FROM submissions;
DELETE FROM problem_statements;
DELETE FROM evaluation_criteria;
DELETE FROM rubrics;
DELETE FROM audit_logs;
DELETE FROM otp_codes;
DELETE FROM allowed_emails;
DELETE FROM users;
