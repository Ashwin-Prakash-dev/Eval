# Workers API

Cloudflare Workers + D1 + R2 port of `backend/`. The FastAPI service is still the source
of truth until the cutover; this directory is additive.

## One-time setup

```bash
cd workers
npm install

# Create the D1 database and paste the printed database_id into wrangler.toml
npx wrangler d1 create eval-db

# Create the R2 bucket named in wrangler.toml
npx wrangler r2 bucket create eval-uploads
```

## Secrets

Never put these in `wrangler.toml`.

| Secret | Purpose |
| --- | --- |
| `JWT_SECRET_KEY` | HS256 signing key for access tokens |
| `OTP_PEPPER` | server-side key for the HMAC-SHA256 passcode hash |
| `BREVO_API_KEY` | Brevo transactional email key; when unset the passcode is echoed in the API response, but only when `ENVIRONMENT != production` |

For deployments:

```bash
npx wrangler secret put JWT_SECRET_KEY
npx wrangler secret put OTP_PEPPER
npx wrangler secret put BREVO_API_KEY
```

For local development, create `workers/.dev.vars` (gitignored):

```
JWT_SECRET_KEY=some-long-random-string
OTP_PEPPER=another-long-random-string
BREVO_API_KEY=
```

Generate a key with `openssl rand -base64 48`.

## Migrations

```bash
npm run db:migrate:local    # apply to the local dev D1
npm run db:migrate:remote   # apply to the deployed D1
```

## Develop

```bash
npm run dev         # wrangler dev on :8787
npm run typecheck   # tsc --noEmit
npm run dryrun      # build without deploying
```
