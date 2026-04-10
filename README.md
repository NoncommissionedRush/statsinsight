# StatInsight Deployment

This repo has:

- `apps/web`: a Vite + React frontend
- `apps/api`: a NestJS API with a small SQLite cache

## Recommended free setup

For this codebase, the easiest low-cost path is:

- Frontend on Cloudflare Pages
- API on Railway

Why this split:

- Cloudflare Pages is a good fit for a static Vite frontend.
- The API writes to SQLite, so it needs persistent storage. Railway still offers a free plan with a small monthly credit, which is a better fit than hosts that discard local disk on redeploy.

## Local environment

Frontend:

1. Copy `apps/web/.env.example` to `apps/web/.env.local`
2. Keep `VITE_API_BASE_URL` empty for local development

API:

1. Optional: set `GEMINI_API_KEY` to enable AI analysis
2. Optional: set `SQLITE_PATH` if you want the cache file somewhere other than `apps/api/data/cache.sqlite`

## Deploy the API on Railway

Create a new Railway service from this repo and use these settings:

- Root directory: `/`
- Build command: `npm install && npm run build:packages && npm -w apps/api run build`
- Start command: `npm -w apps/api run start:prod`
- Healthcheck path: `/api/health`

Environment variables:

- `PORT`: leave unset, Railway injects it automatically
- `SQLITE_PATH`: `/data/cache.sqlite`
- `GEMINI_API_KEY`: your Gemini key if you want the AI analysis feature enabled

Storage:

1. Add a volume in Railway
2. Mount it at `/data`

## Deploy the frontend on Cloudflare Pages

Create a Pages project from this repo and use:

- Framework preset: `Vite`
- Root directory: `apps/web`
- Build command: `npm run build`
- Build output directory: `dist`

Environment variables:

- `VITE_API_BASE_URL`: your Railway API base URL, for example `https://your-api.up.railway.app`

The frontend will call `${VITE_API_BASE_URL}/api/...` in production.

## Notes

- If you do not set `GEMINI_API_KEY`, the app should still work except for AI-generated analysis.
- SQLite is only used as a cache here, so losing the volume is inconvenient but not catastrophic.
- If you want a single-host deployment instead, we can also package this for Railway only, but the split setup is the best "free-ish" option for this repo.
