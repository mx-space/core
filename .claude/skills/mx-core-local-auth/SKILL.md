---
name: mx-core-local-auth
description: Create and reuse a short-lived local mx-core owner session when UI or API verification encounters a login gate, redirect, 401, or AUTH_NOT_LOGGED_IN response. Use only against the local development database and remove the temporary session after verification.
---

# Local authentication during verification

Treat authentication as an on-demand branch of the verification being performed.

1. Attempt the exact UI or API operation that needs verification.
2. If it succeeds anonymously, continue without creating authentication state.
3. If it fails on authentication, create one short-lived owner session directly
   in the local PostgreSQL `sessions` table.
4. Reuse that session for the original operation, collect the required evidence,
   and delete the session immediately afterward.

## Create the temporary session

Use the repository's configured local `PG_URL`; do not assume a container name or
hard-code database credentials. Generate a unique session ID and a high-entropy
token without a `.` character. Insert a session that expires in at most 15 minutes:

```sql
WITH target AS (
  SELECT r.id, a.provider_id
  FROM readers AS r
  JOIN accounts AS a ON a.user_id = r.id
  WHERE r.role = 'owner'
  ORDER BY r.created_at
  LIMIT 1
)
INSERT INTO sessions (id, user_id, token, expires_at, provider)
SELECT '<session-id>', id, '<session-token>', now() + interval '15 minutes', provider_id
FROM target;
```

Fail if no owner account was selected or the insert did not create exactly one
row. Do not create or modify a reader, account, password, or API key.

## Reuse the session

- For API verification, send the raw token as
  `Authorization: Bearer <session-token>`. The enabled Better Auth `bearer()`
  plugin signs it internally and resolves the matching database session.
- For browser UI verification, sign the token with the local `JWT_SECRET` using
  HMAC-SHA256 with standard Base64 output, then set
  `better-auth.session_token=<token>.<signature>` in the same browser context
  used for evidence. Let the browser cookie API encode the value; when writing a
  raw `Cookie` header, URL-encode it first. Never print the secret, token, or
  cookie.

Retry the exact protected operation rather than adding a separate authentication
test. Local development routes have no `/api/v1` prefix.

## Cleanup and boundaries

Delete the temporary row by both ID and token in a `finally`-style cleanup, even
when verification fails. This workflow is forbidden for staging, production,
shared databases, or any database whose local ownership is uncertain.
