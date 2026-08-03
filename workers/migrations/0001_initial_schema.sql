-- Initial schema, translated 1:1 from the SQLAlchemy models in backend/app/models.
--
-- Type mapping: VARCHAR(n)/Text -> TEXT (length limits are enforced by zod at the API
-- edge, exactly as Pydantic enforced them before); Float -> REAL; Boolean -> INTEGER 0/1;
-- JSON -> TEXT holding a JSON document; DateTime(timezone=True) -> TEXT holding an
-- ISO-8601 UTC timestamp (e.g. 2026-08-03T12:34:56.789Z), which sorts lexicographically
-- in chronological order for the ORDER BY created_at queries.
--
-- `updated_at` had onupdate=func.now() in SQLAlchemy, which was a Python-side hook rather
-- than a database trigger. There is no D1 equivalent, so every UPDATE statement in the
-- application must set updated_at explicitly.

CREATE TABLE users (
    id          INTEGER PRIMARY KEY,
    email       TEXT    NOT NULL,
    full_name   TEXT,
    role        TEXT    NOT NULL DEFAULT 'judge',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login  TEXT
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE allowed_emails (
    id            INTEGER PRIMARY KEY,
    email         TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'judge',
    full_name     TEXT,
    note          TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by_id INTEGER,
    FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX ix_allowed_emails_email ON allowed_emails (email);

CREATE TABLE otp_codes (
    id          INTEGER PRIMARY KEY,
    email       TEXT    NOT NULL,
    code_hash   TEXT    NOT NULL,
    expires_at  TEXT    NOT NULL,
    consumed_at TEXT,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_otp_codes_email ON otp_codes (email);

CREATE TABLE problem_statements (
    id          INTEGER PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE submissions (
    id                   INTEGER PRIMARY KEY,
    project_title        TEXT NOT NULL,
    team_identifier      TEXT NOT NULL,
    short_description    TEXT NOT NULL DEFAULT '',
    additional_notes     TEXT,
    problem_statement_id INTEGER,
    ppt_file_path        TEXT,
    pdf_file_path        TEXT,
    video_type           TEXT NOT NULL DEFAULT 'youtube',
    video_url            TEXT,
    video_file_path      TEXT,
    created_by_id        INTEGER,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (problem_statement_id) REFERENCES problem_statements (id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE rubrics (
    id                     INTEGER PRIMARY KEY,
    name                   TEXT    NOT NULL,
    is_active              INTEGER NOT NULL DEFAULT 0,
    disagreement_threshold REAL    NOT NULL DEFAULT 1.5,
    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE evaluation_criteria (
    id          INTEGER PRIMARY KEY,
    rubric_id   INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    weight      REAL    NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (rubric_id) REFERENCES rubrics (id) ON DELETE CASCADE
);

CREATE TABLE assignments (
    id             INTEGER PRIMARY KEY,
    submission_id  INTEGER NOT NULL,
    judge_id       INTEGER NOT NULL,
    assigned_by_id INTEGER,
    source         TEXT    NOT NULL DEFAULT 'auto',
    assigned_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_assignment_submission_judge UNIQUE (submission_id, judge_id),
    FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE conflict_exclusions (
    id            INTEGER PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    judge_id      INTEGER NOT NULL,
    reason        TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_conflict_submission_judge UNIQUE (submission_id, judge_id),
    FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE evaluations (
    id                     INTEGER PRIMARY KEY,
    assignment_id          INTEGER NOT NULL UNIQUE,
    submission_id          INTEGER NOT NULL,
    judge_id               INTEGER NOT NULL,
    status                 TEXT    NOT NULL DEFAULT 'not_started',
    weighted_overall_score REAL,
    time_spent_seconds     INTEGER NOT NULL DEFAULT 0,
    started_at             TEXT,
    completed_at           TEXT,
    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE evaluation_scores (
    id            INTEGER PRIMARY KEY,
    evaluation_id INTEGER NOT NULL,
    criterion_id  INTEGER NOT NULL,
    score         REAL,
    comment       TEXT,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_score_evaluation_criterion UNIQUE (evaluation_id, criterion_id),
    FOREIGN KEY (evaluation_id) REFERENCES evaluations (id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria (id) ON DELETE CASCADE
);

CREATE TABLE comments (
    id            INTEGER PRIMARY KEY,
    evaluation_id INTEGER NOT NULL UNIQUE,
    body          TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (evaluation_id) REFERENCES evaluations (id) ON DELETE CASCADE
);

CREATE TABLE submission_scores (
    submission_id     INTEGER PRIMARY KEY,
    overall_score     REAL,
    criterion_means   TEXT    NOT NULL DEFAULT '{}',
    highest_score     REAL,
    lowest_score      REAL,
    std_dev           REAL,
    reviews_completed INTEGER NOT NULL DEFAULT 0,
    is_flagged        INTEGER NOT NULL DEFAULT 0,
    computed_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   INTEGER,
    details     TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
