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
    core/        config, database session, JWT/password helpers
    models/      SQLAlchemy models (Users, Submissions, Rubrics, Criteria,
                 Assignments, ConflictExclusions, Evaluations, EvaluationScores,
                 Comments, SubmissionScore, AuditLogs)
    schemas/     Pydantic request/response schemas
    crud/        thin data-access layer, one module per entity
    services/    business logic: auth, file storage, assignment generator,
                 scoring engine, analytics/leaderboard aggregation, export
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

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate           # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env          # cp on macOS/Linux — sqlite:///./dev.db works out of the box
alembic upgrade head
python seed.py                  # creates the admin account + default rubric
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

Log in with the seeded admin account: **admin / ChangeMe123!** — change
`ADMIN_PASSWORD` in `.env` before any real use. Every other account created via
the Register page becomes a Judge.

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

- **Team identity is enforced server-side.** `SubmissionOut` (admin) includes
  `team_identifier`; `SubmissionJudgeOut` (judge) does not have the field at
  all — it's not a UI toggle, so there's no way to leak it from the judge-facing
  routes even by accident.
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
