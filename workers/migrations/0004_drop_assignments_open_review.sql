-- Removes the assignment layer. Every judge may now review every submission, and a
-- submission's score counts only the FIRST FIVE evaluations to be COMPLETED (see
-- SCORING_EVALUATION_LIMIT in src/services/scoring.ts).
--
-- Consequences baked in here:
--
-- 1. `assignments` is dropped. An evaluation is no longer created up-front by an admin
--    allocating work; it is created on demand the first time a judge opens a submission.
--    `evaluations.assignment_id` goes with it, and `(submission_id, judge_id)` becomes the
--    natural key -- one evaluation per judge per submission, which the old unique constraint
--    on `assignments` used to enforce indirectly.
--
-- 2. `flagged_for_review` is added: a judge's private bookmark for a submission they want to
--    return to. Visible only to that judge -- see the admin serializer, which omits it.
--
-- 3. `conflict_exclusions` is dropped. Its only consumer was the assignment generator; with
--    every judge free to review everything there is nothing left for it to constrain.
--
-- Existing evaluations are preserved. Any row whose (submission_id, judge_id) pair somehow
-- duplicates another would violate the new constraint, but the old `assignments` unique
-- constraint already made that impossible.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE evaluations_new (
    id                     INTEGER PRIMARY KEY,
    submission_id          TEXT    NOT NULL,
    judge_id               INTEGER NOT NULL,
    status                 TEXT    NOT NULL DEFAULT 'not_started',
    weighted_overall_score REAL,
    time_spent_seconds     INTEGER NOT NULL DEFAULT 0,
    started_at             TEXT,
    completed_at           TEXT,
    -- A judge's private "come back to this" bookmark. Deliberately on the judge's own
    -- evaluation row rather than a shared table, so it is scoped to one judge by
    -- construction and cannot leak to another judge or to an admin. NOT the same thing as
    -- submission_scores.is_flagged, which marks judge disagreement and is admin-facing.
    flagged_for_review     INTEGER NOT NULL DEFAULT 0,
    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_evaluation_submission_judge UNIQUE (submission_id, judge_id),
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO evaluations_new
    (id, submission_id, judge_id, status, weighted_overall_score,
     time_spent_seconds, started_at, completed_at, updated_at)
SELECT
     id, submission_id, judge_id, status, weighted_overall_score,
     time_spent_seconds, started_at, completed_at, updated_at
FROM evaluations;

DROP TABLE evaluations;
ALTER TABLE evaluations_new RENAME TO evaluations;

-- Ordering the completed set is now on the hot path for every rescore.
CREATE INDEX ix_evaluations_submission_completed
    ON evaluations (submission_id, completed_at);

DROP TABLE conflict_exclusions;
DROP TABLE assignments;
