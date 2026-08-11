-- Drops the local `submissions` table. Submissions now live in the startathon system as
-- `startathon_applications`, read directly through a second D1 binding (EVENTS_DB) rather
-- than copied here -- see src/repo/application.ts.
--
-- Two consequences are baked into this migration:
--
-- 1. `submission_id` becomes TEXT everywhere. The startathon key is `team_id TEXT`, not an
--    autoincrement integer. Existing integer ids are CAST rather than dropped so the tables
--    survive the change, but note they will not match any real team_id -- any pre-existing
--    assignment/evaluation rows are dev data and should be cleared.
--
-- 2. The four `REFERENCES submissions(id) ON DELETE CASCADE` constraints are gone. D1 has no
--    cross-database foreign keys. Nothing now stops a row pointing at a team that no longer
--    exists, and deleting a team on the startathon side no longer cascades here. Reads must
--    tolerate a missing application (see applicationsByIds in src/repo/application.ts).

PRAGMA defer_foreign_keys = ON;

CREATE TABLE assignments_new (
    id             INTEGER PRIMARY KEY,
    submission_id  TEXT    NOT NULL,
    judge_id       INTEGER NOT NULL,
    assigned_by_id INTEGER,
    source         TEXT    NOT NULL DEFAULT 'auto',
    assigned_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_assignment_submission_judge UNIQUE (submission_id, judge_id),
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO assignments_new (id, submission_id, judge_id, assigned_by_id, source, assigned_at)
SELECT id, CAST(submission_id AS TEXT), judge_id, assigned_by_id, source, assigned_at
FROM assignments;
DROP TABLE assignments;
ALTER TABLE assignments_new RENAME TO assignments;

CREATE TABLE conflict_exclusions_new (
    id            INTEGER PRIMARY KEY,
    submission_id TEXT    NOT NULL,
    judge_id      INTEGER NOT NULL,
    reason        TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_conflict_submission_judge UNIQUE (submission_id, judge_id),
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE
);
INSERT INTO conflict_exclusions_new (id, submission_id, judge_id, reason, created_at)
SELECT id, CAST(submission_id AS TEXT), judge_id, reason, created_at
FROM conflict_exclusions;
DROP TABLE conflict_exclusions;
ALTER TABLE conflict_exclusions_new RENAME TO conflict_exclusions;

CREATE TABLE evaluations_new (
    id                     INTEGER PRIMARY KEY,
    assignment_id          INTEGER NOT NULL UNIQUE,
    submission_id          TEXT    NOT NULL,
    judge_id               INTEGER NOT NULL,
    status                 TEXT    NOT NULL DEFAULT 'not_started',
    weighted_overall_score REAL,
    time_spent_seconds     INTEGER NOT NULL DEFAULT 0,
    started_at             TEXT,
    completed_at           TEXT,
    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE
);
INSERT INTO evaluations_new
    (id, assignment_id, submission_id, judge_id, status, weighted_overall_score,
     time_spent_seconds, started_at, completed_at, updated_at)
SELECT
     id, assignment_id, CAST(submission_id AS TEXT), judge_id, status, weighted_overall_score,
     time_spent_seconds, started_at, completed_at, updated_at
FROM evaluations;
DROP TABLE evaluations;
ALTER TABLE evaluations_new RENAME TO evaluations;

CREATE TABLE submission_scores_new (
    submission_id     TEXT    PRIMARY KEY,
    overall_score     REAL,
    criterion_means   TEXT    NOT NULL DEFAULT '{}',
    highest_score     REAL,
    lowest_score      REAL,
    std_dev           REAL,
    reviews_completed INTEGER NOT NULL DEFAULT 0,
    is_flagged        INTEGER NOT NULL DEFAULT 0,
    computed_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO submission_scores_new
    (submission_id, overall_score, criterion_means, highest_score, lowest_score,
     std_dev, reviews_completed, is_flagged, computed_at)
SELECT
     CAST(submission_id AS TEXT), overall_score, criterion_means, highest_score, lowest_score,
     std_dev, reviews_completed, is_flagged, computed_at
FROM submission_scores;
DROP TABLE submission_scores;
ALTER TABLE submission_scores_new RENAME TO submission_scores;

DROP TABLE submissions;
