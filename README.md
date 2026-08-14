# Hackathon Evaluation Platform

An internal tool for organizers and judges to score hackathon submissions after
the event website has already collected them. Not a public-facing site — there
are exactly two roles (Admin, Judge), no participant accounts, and no public pages.

## Stack

- **Frontend**: React 19, TypeScript, Vite, React Router, TailwindCSS, shadcn/ui
  (Radix primitives), TanStack Query, TanStack Table, React Hook Form + Zod,
  Zustand, Framer Motion, Recharts.
- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic, JWT auth (PyJWT + bcrypt).

The two are fully decoupled — the frontend only talks to the backend over
`/api/*` REST endpoints (proxied by Vite in dev, by nginx in the Docker build).

## Repository layout

```
backend/
  app/
    core/        config, database session, JWT/hashing helpers
    models/      SQLAlchemy models (Users, AllowedEmails, OtpCodes, Submissions,
                 ProblemStatements, Rubrics, Criteria,
                 Assignments, ConflictExclusions, Evaluations, EvaluationScores,
                 Comments, SubmissionScore, AuditLogs)
    schemas/     Pydantic request/response schemas
    crud/        thin data-access layer, one module per entity
    services/    business logic: auth (passcodes), email delivery, file storage,
                 assignment generator, scoring engine, analytics/leaderboard
                 aggregation, export
    api/routes/  FastAPI routers, one per resource
  alembic/       migrations
  seed.py        seeds the admin account + a default rubric
frontend/
  src/
    app/         router, layout shell (sidebar/topbar), theme, protected routes
    components/ui/      shadcn/ui primitives
    components/shared/   DataTable, PageHeader, StatCard, media viewers, etc.
    features/    one folder per domain — submissions, judges, rubric,
                 assignments, evaluation, analytics, leaderboard, audit, auth —
                 each with its own api.ts, hooks.ts, components/, pages/
    hooks/, lib/, store/, types/
docker-compose.yml   Postgres + backend + frontend (nginx), for a full local stack
```

## Quick start (local dev, SQLite, zero infrastructure)

**One-time setup:**

```bash
cd backend
python -m venv venv
venv\Scripts\activate           # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env          # cp on macOS/Linux — sqlite:///./dev.db works out of the box
alembic upgrade head
python seed.py                  # approves the admin email + creates the default rubric

cd ../frontend
npm install

cd ..
npm install                     # root-level, just installs `concurrently`
```

**Every time after that**, from the repo root:

```bash
npm run dev
```

This runs both servers in one terminal (backend on `:8000`, frontend on
`:5173`, labeled `[BACKEND]`/`[FRONTEND]`). `npm run dev:backend` /
`npm run dev:frontend` run just one half if you'd rather use two terminals —
the root `package.json` only wires the two together with `concurrently`; the
`backend\venv\Scripts\python.exe` path in `dev:backend` is Windows-specific, so
on macOS/Linux either run the two `uvicorn`/`npm run dev` commands in separate
terminals as shown above, or point that script at `backend/venv/bin/python`.

Sign in with the seeded administrator address (`ADMIN_EMAIL`, default
`admin@example.com`). There are no passwords — see below.

## Authentication: approved emails + one-time passcodes

There is no password anywhere in the system and no self-registration.

1. An administrator approves an email address on the **Judges & access** page
   (singly or in bulk), choosing whether it gets the Judge or Admin role.
2. That person enters their email on the sign-in screen and receives a 6-digit
   passcode by email.
3. Entering the passcode signs them in. Their account row is created
   automatically on that first sign-in — the approved-email list is always the
   authority on who may access the tool and with what role.

Guardrails: passcodes are stored only as bcrypt hashes, expire after 10 minutes,
are single-use, are invalidated when a newer one is issued, lock out after 5 wrong
attempts, and are rate-limited (60s between sends, 5/hour per address). Revoking
an approved email immediately deactivates the account, so any live JWT stops
working on its next request. All of these are configurable in `.env`.

> **Local development without a mail server.** If `SMTP_HOST` is unset, the
> passcode is written to the server log *and returned in the sign-in API
> response* so you can log in with zero setup — the login screen surfaces it as
> a toast. That means anyone who can reach the API can sign in as any approved
> address, so **set `SMTP_HOST` before exposing this to a network.** Once SMTP is
> configured the passcode is emailed and never appears in the response.

## Running against real PostgreSQL

The ORM layer is dialect-agnostic; SQLite above is purely a zero-setup
convenience for local development. For anything resembling production, either:

- Point `DATABASE_URL` in `backend/.env` at a real Postgres instance, e.g.
  `postgresql+psycopg2://user:pass@host:5432/dbname`, or
- Run the whole stack (Postgres + backend + frontend/nginx) via:

  ```bash
  docker compose up --build
  ```

  The frontend serves on `http://localhost`, the API on `http://localhost:8000`.
  The backend container runs Alembic migrations and the seed script on startup.

## Design notes worth knowing

- **Review is not blind.** Judges see `team_identifier` just as admins do.
  `SubmissionOut` and `SubmissionJudgeOut` are still separate shapes — the admin
  one additionally carries `created_at`/`updated_at` — and neither mapper ever
  spreads a database row, so a new column on the startathon side reaches an API
  response only when someone writes it out by name.
- **File access is authorization-scoped, not just a static file mount.** Admins
  fetch submission files via `/api/submissions/{id}/file/{kind}`; judges fetch
  the same underlying file via `/api/evaluations/{evaluation_id}/file/{kind}`,
  which checks that the evaluation belongs to them. Both stream from local disk
  (`backend/uploads/`); swap `file_service.py` for S3/Azure Blob if you need
  durable storage across deployments.
- **PPT files aren't rendered inline.** There's no reliable, dependency-free way
  to render `.pptx` in a browser tab. The evaluation page offers a labeled
  download card for slide decks instead of pretending to preview them; PDF
  decks render natively in an `<iframe>`.
- **Assignment generation is a greedy least-loaded balancer**, not a strict
  "divide evenly" calculator: it walks submissions that still need coverage and
  hands each one to the *N* currently-least-loaded eligible judges (respecting
  conflict-of-interest exclusions), which converges to an exactly-even
  distribution when the numbers divide evenly, and a ±1 spread otherwise. It's
  idempotent — re-running it only tops up submissions that still need judges,
  so manual reassignments made in between are respected.
- **Scoring is recomputed synchronously** whenever a judge's evaluation is
  marked complete (or edited after completion), not on a cron or on read. Each
  judge's own weighted overall score is computed from their raw per-criterion
  scores using the active rubric's weights; the submission's stored
  `overall_score`/`highest`/`lowest`/`std_dev` are aggregates across judges'
  weighted scores, and `is_flagged` trips when `std_dev` exceeds the rubric's
  configurable disagreement threshold.
- **Autosave has no save button by design.** Every score/comment change is
  applied to local state immediately and flushed to the API on a ~900ms debounce
  carrying the full current snapshot (never a partial diff), so out-of-order
  network responses can't clobber a newer edit with a stale one — the field-level
  upsert on the backend only overwrites a criterion's score/comment when the
  incoming value is non-null.

## API reference

The backend serves interactive OpenAPI docs at `/docs` (Swagger UI) and
`/redoc` once running — every endpoint, schema, and validation rule described above is browsable there.
