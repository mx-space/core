# @mx-space/telemetry

Anonymous instance telemetry collector for self-hosted mx-core deployments — a Cloudflare Worker backed by D1.

## What it collects

mx-core instances POST a minimal payload to `/collect`:

```json
{ "instanceId": "<uuid>", "version": "13.25.1", "nodeVersion": "22.0.0", "event": "startup" }
```

- `event` is one of `startup` or `heartbeat` (sent hourly).
- `instanceId` is a random UUID persisted in the instance's data directory — it is not derived from any user or site data.
- Field lengths are capped at 64 chars; anything else is rejected with `400`.

Users opt out with `--disable_telemetry` or `MX_DISABLE_TELEMETRY=true` (see `apps/core/src/utils/telemetry.util.ts`).

## Endpoints

| Route | Description |
|-------|-------------|
| `POST /collect` | Ingest one event (validated, inserted into D1) |
| `GET /stats` | JSON aggregates: total/active instances, version & Node distributions, daily series (last 30d) |
| `GET /` or `/dashboard` | Server-rendered Chart.js dashboard |

> [!NOTE]
> `/stats` and the dashboard are gated externally by Cloudflare Zero Trust, not by the Worker itself. `/collect` is open (CORS `*`) so any self-hosted instance can post.

A daily cron (`0 3 * * *`) deletes rows older than 90 days.

## Development

```bash
pnpm -C apps/telemetry run dev                 # wrangler dev
pnpm -C apps/telemetry run db:migrate          # apply schema.sql to local D1
pnpm -C apps/telemetry run db:migrate:remote   # apply schema.sql to remote D1
pnpm -C apps/telemetry run deploy              # wrangler deploy
```

- `schema.sql` — the single `telemetry` table and its indexes.
- `mock-data.sql` — seed data so the local dashboard renders non-empty.
- `preview.html` — standalone static mock of the dashboard (hardcoded numbers) for design iteration; does not call the Worker.
