# Parity checklist: FastAPI → Workers

All 47 routes ported. Auth column verified by probing every GET at three levels
(anonymous / judge / admin) against a live `wrangler dev`; the triples match the FastAPI
dependency table exactly.

`anon` is 401 everywhere except `/health`. "any" = any authenticated user.

## Routes

| Method | Path | Auth | Status codes | Notes |
| --- | --- | --- | --- | --- |
| GET | `/health` | public | 200 | |
| POST | `/api/auth/request-otp` | public | 200, 403, 422, 429, 502 | `dev_passcode` additionally gated on non-production |
| POST | `/api/auth/verify-otp` | public | 200, 401, 403, 422, 429 | |
| GET | `/api/auth/me` | any | 200, 401 | |
| GET | `/api/problem-statements` | any | 200 | |
| POST | `/api/problem-statements` | admin | 201, 409, 422 | |
| PATCH | `/api/problem-statements/{id}` | admin | 200, 404, 422 | |
| DELETE | `/api/problem-statements/{id}` | admin | 204, 404 | |
| GET | `/api/submissions` | admin | 200, 422 | no page_size bound, as before |
| POST | `/api/submissions` | admin | 201, 400, 422 | |
| GET | `/api/submissions/{id}` | admin | 200, 404, 422 | |
| PATCH | `/api/submissions/{id}` | admin | 200, 404, 422 | exclude_unset semantics |
| DELETE | `/api/submissions/{id}` | admin | 204, 404 | deletes R2 objects first |
| POST | `/api/submissions/{id}/upload/{kind}` | admin | 200, 400, 404, 413, 422 | |
| GET | `/api/submissions/{id}/file/{kind}` | admin | 200, 206, 400, 404, 416 | Range supported |
| POST | `/api/submissions/bulk-import` | admin | 200, 422 | |
| GET | `/api/rubrics/active` | any | 200, 404 | |
| GET | `/api/rubrics` | admin | 200 | |
| POST | `/api/rubrics` | admin | 201, 422 | weights must total 100 |
| PATCH | `/api/rubrics/{id}` | admin | 200, 404, 422 | `criteria: null` is a no-op |
| POST | `/api/rubrics/{id}/activate` | admin | 200, 404 | exactly one active |
| DELETE | `/api/rubrics/{id}` | admin | 204, 404 | |
| GET | `/api/assignments` | admin | 200, 422 | |
| POST | `/api/assignments` | admin | 201, 404, 409, 422 | ignores conflict exclusions, as before |
| DELETE | `/api/assignments/{id}` | admin | 204, 404 | cascades the evaluation |
| POST | `/api/assignments/generate` | admin | 200, 400, 422 | allocation verified identical |
| GET | `/api/assignments/conflicts` | admin | 200 | |
| POST | `/api/assignments/conflicts` | admin | 201, 422 | |
| DELETE | `/api/assignments/conflicts/{id}` | admin | 204, 404 | |
| GET | `/api/judges` | admin | 200 | |
| PATCH | `/api/judges/{id}` | admin | 200, 404, 422 | |
| GET | `/api/judges/stats` | admin | 200 | stats verified identical |
| GET | `/api/judges/allowed` | admin | 200 | |
| POST | `/api/judges/allowed` | admin | 201, 409, 422 | |
| POST | `/api/judges/allowed/bulk` | admin | 200, 422 | |
| PATCH | `/api/judges/allowed/{id}` | admin | 200, 404, 422 | no `role` field, as before |
| DELETE | `/api/judges/allowed/{id}` | admin | 204, 400, 404 | |
| GET | `/api/evaluations/assigned` | judge | 200 | omits `team_identifier` |
| GET | `/api/evaluations/progress` | judge | 200 | |
| GET | `/api/evaluations/{id}` | judge (owner) | 200, 404, 422 | 404 not 403 for another judge's |
| PATCH | `/api/evaluations/{id}` | judge (owner) | 200, 404, 422 | triggers score recompute |
| GET | `/api/evaluations/{id}/file/{kind}` | judge (owner) | 200, 206, 400, 404, 416 | |
| GET | `/api/evaluations/submission/{id}/all` | admin | 200, 422 | |
| GET | `/api/analytics/overview` | admin | 200 | |
| GET | `/api/analytics/leaderboard` | admin | 200, 422 | |
| GET | `/api/audit-logs` | admin | 200, 422 | `details` is an object |
| GET | `/api/export/{format}` | admin | 200, 400 | csv / xlsx / pdf |

## Verified equivalence

Replayed identical fixtures through the real `backend/app/services` and diffed:

- **Assignment generator** — same (submission, judge) pairs, same counts and min/max load,
  conflicts honoured. Idempotent re-run and top-up behave identically.
- **`recompute_submission_score`** — every field identical, including per-evaluation
  weighted scores and banker's-rounded values.
- **`compute_judge_stats`** — every field identical across judges, including the
  harsh / lenient / high-variance flags.
- **Statistics primitives** — matched CPython over 323 rounding and 10 statistics cases.
- **CSV export** — round-trips byte for byte through Python's own `csv` module.
- **XLSX export** — opens in openpyxl with the same sheets and values.

## Intentional differences

| Area | Difference | Why |
| --- | --- | --- |
| Passcode hashing | HMAC-SHA256 + `OTP_PEPPER` instead of bcrypt | bcrypt cannot run in the Workers runtime; a 6-digit keyspace needs a secret, not a slow hash |
| Email | Brevo HTTP API instead of SMTP | Workers cannot open raw TCP |
| `dev_passcode` | Also requires `ENVIRONMENT != production` | a deployment without a mail provider must not hand out passcodes |
| Upload cap | 100 MB instead of 300 MB | Workers request-body limit on Free/Pro |
| Timestamps | ISO-8601 UTC TEXT | database started clean; sorts chronologically, parses as a JS Date |
| PDF export | Fixed-column layout instead of reportlab Tables | same content, different layout engine |
| `PATCH /rubrics` `{"name": null}` | 422 | FastAPI accepts it and then 500s on the NOT NULL column |
| 422 bodies | Shape matches (`detail` array, source-prefixed `loc`); some Pydantic `type` strings differ for exotic constraint failures | the frontend reads `msg` only |

## Not ported

- `alembic upgrade head && python seed.py` ran at container start. Workers has no startup
  hook, so the admin allowlist and default rubric must be seeded once via
  `wrangler d1 execute` (see README).

## Open items before cutover

1. Remote D1 has no schema yet — run `npm run db:migrate:remote`.
2. Seed the bootstrap admin allowlist row in the remote database.
3. `wrangler` is v3; the runtime warns that `compatibility_date` exceeds what it supports
   and falls back to 2025-07-18.
4. Deployment topology for the frontend (Pages/static + Worker route) is not set up;
   `nginx.conf` still targets the FastAPI container.
5. The allowlist `role` is not editable through any endpoint on either backend.
