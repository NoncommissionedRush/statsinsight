# StatInsight Deployment

This repo has:

- `apps/web`: a Vite + React frontend
- `apps/api`: a NestJS API with a small SQLite cache

## Recommended single deployment

The frontend can be built into `apps/web/dist`, and the Nest app will serve those files directly in production.

That means you can deploy this as one service on Railway:

- `/api/*` stays handled by Nest
- `/` and other frontend routes serve the React app

## Local environment

Frontend:

1. Copy `apps/web/.env.example` to `apps/web/.env.local`
2. Keep `VITE_API_BASE_URL` empty for local development

API:

1. Optional: set `GEMINI_API_KEY` to enable AI analysis
2. Optional: set `SQLITE_PATH` if you want the cache file somewhere other than `apps/api/data/cache.sqlite`

## Local production-style run

From the repo root:

1. `npm install`
2. `npm run build`
3. `npm start`

## Deploy on Railway

Create a new Railway service from this repo and use these settings:

- Root directory: `/`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Healthcheck path: `/api/health`

Environment variables:

- `PORT`: leave unset, Railway injects it automatically
- `SQLITE_PATH`: `/data/cache.sqlite`
- `GEMINI_API_KEY`: your Gemini key if you want the AI analysis feature enabled
- `RAILPACK_DEPLOY_APT_PACKAGES`: `chromium`

Storage:

1. Add a volume in Railway
2. Mount it at `/data`

## Important frontend setting

For single-service deploys, set:

- `VITE_API_BASE_URL`: empty

That keeps the frontend calling the same host at `/api/...`.

## Notes

- If you do not set `GEMINI_API_KEY`, the app should still work except for AI-generated analysis.
- SQLite is only used as a cache here, so losing the volume is inconvenient but not catastrophic.
- This setup is aimed at one-host deployment, not separate frontend/backend hosting.
