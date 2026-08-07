---
name: mx-core-local-auth
description: How to obtain authenticated session for mx-core local dev server API calls
user-invocable: false
---

## When to Use

When you need to make authenticated API calls to a local mx-core dev server (e.g. triggering AI TTS tasks, managing posts/notes, hitting any `/ai/*` endpoint) and don't have a browser session cookie handy.

## The Problem

The mx-core backend uses **better-auth** with cookie-based sessions. The `@Auth()` decorator checks for a session cookie (`better-auth.session_token`) via `authService.getSessionUser(request.raw)`. A raw JWT or Bearer token will NOT work — you'll get `AUTH_NOT_LOGGED_IN`.

There is also an `x-api-key` header path, but keys must be created via the better-auth API and are stored hashed — inserting a raw key into the `api_keys` table won't work because `verifyApiKey` uses better-auth's internal verification.

## Solution: Session Cookie via Login

### 1. Get the DB credentials

```bash
grep "PG_URL" /Users/innei/git/innei-repo/mx-core/.env
# e.g. PG_URL=postgres://mx:mx@127.0.0.1:5433/mx_core
```

### 2. Find the owner's username

```bash
docker exec mx-pg-dev psql -U mx -d mx_core -c "SELECT id, username FROM readers LIMIT 5"
```

### 3. Reset the password (if you don't know it)

The password hash uses better-auth's `hashPassword`. Hash a known password and update the `accounts` table:

```bash
cd /Users/innei/git/innei-repo/mx-core/apps/core
node -e "const { hashPassword } = require('better-auth/crypto'); hashPassword('test123').then(h => console.log(h))"
# Output: <salt>:<hash>

docker exec mx-pg-dev psql -U mx -d mx_core -c \
  "UPDATE accounts SET password = '<hash>' WHERE provider_id = 'credential' RETURNING user_id"
```

### 4. Login and save cookies

```bash
curl -s -X POST http://localhost:2333/auth/sign-in/username \
  -H "Content-Type: application/json" \
  -d '{"username":"<username>","password":"test123"}' \
  -c /tmp/cookies.txt
```

The response includes the user info, and `/tmp/cookies.txt` contains the `better-auth.session_token` cookie.

### 5. Use the cookie for authenticated requests

```bash
curl -s -X POST http://localhost:2333/ai/tts/task \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"refId":"<note_id>","langs":["zh"]}'
```

## Key Details

- **Dev mode has no `/api/v1` prefix**: Routes are at `http://localhost:2333/ai/tts/task`, not `/api/v1/ai/tts/task`.
- **Auth base path in dev**: `/auth` (not `/api/v1/auth`).
- **PostgreSQL runs in Docker**: Container `mx-pg-dev`, port `5433`. Use `docker exec mx-pg-dev psql -U mx -d mx_core`.
- **Table names use camelCase** (not snake_case): `ttsOptions`, not `tts_options`. Column names are also camelCase in some tables but the `options` table uses `name`/`value` columns.
- **API responses are snake_cased** by the backend interceptor (`transformResponseCase`), but the `@mx-space/api-client` SDK camelCases them back automatically. Raw `curl` will see `block_id`, `block_order`, etc.
- **Task queue is in Redis**, not PostgreSQL. Check task status with `redis-cli -p 6380 LRANGE "mx:task-queue:<task_id>:logs" 0 -1`.

## TTS-Specific Notes

- TTS config is in the `options` table under `name='ttsOptions'` — contains `provider`, `model`, `voice`, `apiKey`, `enable`, etc.
- To update the OpenRouter API key: `UPDATE options SET value = jsonb_set(value, '{apiKey}', '"sk-or-v1-..."') WHERE name = 'ttsOptions'`
- The `openrouter` provider uses `POST https://openrouter.ai/api/v1/audio/speech` with OpenAI-compatible TTS format.
- Notes/posts content is Lexical JSON in the `content` column. Blocks must have `$.blockId` for TTS to work — blocks without IDs are skipped.
- When inserting Lexical content via psql, use **dollar quoting** (`$tag$...$tag$`) to avoid JSON quote escaping issues. Shell variable interpolation (`$CONTENT`) in `docker exec -e` does NOT work reliably for JSON with special characters.
