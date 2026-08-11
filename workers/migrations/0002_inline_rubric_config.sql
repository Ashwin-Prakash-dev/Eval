-- Moves the rubric (criteria + weights + disagreement threshold) out of the database and
-- into src/config/rubric.ts, and removes problem statements from the system entirely.
--
-- Criteria are now a deployed constant, so `evaluation_criteria` and `rubrics` are dropped.
-- `evaluation_scores.criterion_id` KEEPS its integer values -- they match the `id` field of
-- each entry in CRITERIA, which is why those ids are documented as never-reuse -- but it can
-- no longer be a foreign key, since the table it referenced is gone.
--
-- Problem statements were a pure labelling dimension: nothing in assignment, scoring or
-- flagging ever read them. They are removed along with the `submissions.problem_statement_id`
-- column that carried them.
--
-- SQLite cannot drop a table-level FOREIGN KEY clause in place, so both referencing tables
-- are rebuilt with the create-copy-drop-rename dance. Every other column is copied verbatim
-- and keeps its exact values.

PRAGMA defer_foreign_keys = ON;

-- submissions: drop the problem_statement_id column and its FK, keep everything else.
CREATE TABLE submissions_new (
    id                   INTEGER PRIMARY KEY,
    project_title        TEXT NOT NULL,
    team_identifier      TEXT NOT NULL,
    short_description    TEXT NOT NULL DEFAULT '',
    additional_notes     TEXT,
    ppt_file_path        TEXT,
    pdf_file_path        TEXT,
    video_type           TEXT NOT NULL DEFAULT 'youtube',
    video_url            TEXT,
    video_file_path      TEXT,
    created_by_id        INTEGER,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

INSERT INTO submissions_new
    (id, project_title, team_identifier, short_description, additional_notes,
     ppt_file_path, pdf_file_path, video_type, video_url, video_file_path,
     created_by_id, created_at, updated_at)
SELECT
     id, project_title, team_identifier, short_description, additional_notes,
     ppt_file_path, pdf_file_path, video_type, video_url, video_file_path,
     created_by_id, created_at, updated_at
FROM submissions;

DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;

-- evaluation_scores: drop the criterion_id FK, keep the column and its unique constraint.
CREATE TABLE evaluation_scores_new (
    id            INTEGER PRIMARY KEY,
    evaluation_id INTEGER NOT NULL,
    criterion_id  INTEGER NOT NULL,
    score         REAL,
    comment       TEXT,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_score_evaluation_criterion UNIQUE (evaluation_id, criterion_id),
    FOREIGN KEY (evaluation_id) REFERENCES evaluations (id) ON DELETE CASCADE
);

INSERT INTO evaluation_scores_new
    (id, evaluation_id, criterion_id, score, comment, updated_at)
SELECT
     id, evaluation_id, criterion_id, score, comment, updated_at
FROM evaluation_scores;

DROP TABLE evaluation_scores;
ALTER TABLE evaluation_scores_new RENAME TO evaluation_scores;

DROP TABLE evaluation_criteria;
DROP TABLE rubrics;
DROP TABLE problem_statements;
