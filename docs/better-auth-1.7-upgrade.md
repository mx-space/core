# Better Auth 1.7 security upgrade

This release upgrades `better-auth`, its core, adapters, and the API Key, Expo,
and Passkey plugins from 1.6.27 to 1.7.16 (including the follow-up from 1.7.14).
Core, Admin, CLI, and E2E consumers use the same release through the workspace
overrides, matching Yohaku Web and iOS. `better-call` resolves to 1.4.5.

## Security scope

The old dependency graph matched six Better Auth advisory entries, covering
device approval, OAuth state / Magic Link isolation, OAuth Proxy, and PostgreSQL
rate limiting. The updated graph has no Better Auth advisory matches in
`pnpm audit`. Other packages reported by a full workspace audit are outside this
upgrade.

The 1.7.16 patch also fixes revoked sessions remaining usable through caches,
OAuth profile verification, trusted-origin wildcard matching, Expo authorization
proxy state validation, and Passkey origin / user-verification checks. This
application does not configure Better Auth secondary storage or session cookie
caching. Existing database sessions remain usable; revoked sessions must fail.
The production Passkey configuration already supplies both the admin hostname as
`rpID` and the exact admin origin as `origin`, so the stricter origin check needs
no application change. Keep that explicit origin when configuring another host.

The application enables device authorization and supplies its own approval page.
Upgrading the library alone does not satisfy the
[device authorization advisory](https://github.com/advisories/GHSA-q84f-53jg-9ppm).
The page now displays the server-verified client name, client ID, and exact
requested scopes. Approval remains disabled for an unreviewed code, unavailable
details, an unknown client, or a completed request. The reviewed code is read-only.
The page explains that standalone device authorization grants an account session;
the scope text does not restrict that session's account privileges.

Client validation applies when issuing and redeeming device codes. The supported
clients remain Mix Space CLI (`mxs-cli`) and Space for iOS (`space-ios`).

## Database preparation

No new schema migration is required for this application's enabled features:

- Better Auth 1.7.3 removed the required account `issuer` field introduced by
  1.7.0–1.7.2. This repository never introduced that field.
- Migration `0013_device_codes_table.sql` already provides the unique
  `device_code` and `user_code` indexes required by the standalone device plugin.
- The application uses Apple, GitHub, and Google sign-in. The Microsoft account
  identifier migration and OAuth-provider / SCIM schema changes do not apply.
- The 1.7.14 to 1.7.16 patch adds no required fields for the enabled plugins.
  Existing bcrypt and scrypt passwords, signed session cookies, and bearer
  sessions are covered by PostgreSQL integration tests using persisted rows.
  Existing API key and OAuth token storage migrations are tested separately;
  this dependency upgrade does not activate a new secret-storage mode or rotate
  the signing secret.

Before production deployment, run this read-only check against the target
database. Better Auth 1.7 rejects ambiguous account matches. The existing
`accounts_provider_uniq` index covers `provider_account_id`, which is a separate
legacy field from Better Auth's `account_id`.

```sql
SELECT provider_id, account_id, count(*) AS account_count
FROM accounts
WHERE account_id IS NOT NULL
GROUP BY provider_id, account_id
HAVING count(*) > 1;
```

Resolve any returned rows using verified provider identities before deployment.
Do not merge accounts by email or automatically delete duplicate rows. This
preflight is an operator step; local tests do not inspect the production database.

## Password credential account IDs

Better Auth requires password accounts to have `provider_id = 'credential'`
and `account_id = user_id`. The Drizzle property `accountId` maps to the SQL
column `account_id`; `provider_account_id` is a separate legacy field and
does not satisfy the password-account lookup.

The owner and review-demo creation paths previously populated only
`provider_account_id`, leaving `account_id` null. Such accounts can reject a
correct password after a Better Auth upgrade. Account creation now enforces
the linked user's ID for all password credentials while preserving external
OAuth account IDs.

The release-phase app-data migration `20261113-credential-account-ids`
repairs null, empty, and stale password-account IDs. It runs through the
normal `mx-migrate` / `pnpm -C apps/core run migrate` path and is idempotent;
no schema migration or password reset is required. Password hashes, OAuth
accounts, sessions, and Passkeys are preserved.

If a user has multiple password-account rows, the migration stops without
changing any accounts. Resolve those rows using verified account ownership
before retrying; the migration does not choose a password or merge rows.
The affected users can be identified with this read-only query:

```sql
SELECT user_id, count(*) AS credential_count
FROM accounts
WHERE provider_id = 'credential'
GROUP BY user_id
HAVING count(*) > 1;
```

## Deployment and validation

1. Install with `pnpm install --frozen-lockfile` and build Core and Admin together.
2. Coordinate the authentication cutover across all Core replicas and any
   environments sharing OAuth state. Stop old authentication handlers before
   directing authentication requests to the new release.
3. Restart unfinished OAuth sign-in and account-linking flows. Security fixes
   reject state issued by the old release; this does not require deleting users
   or account rows.
4. Verify existing-owner password / username login, the existing session, API
   keys, social login, and Passkey login on the deployed origin.
5. Start a CLI or iOS device login. Confirm the approval page shows the expected
   application, the exact code visible on that device, and the requested scopes;
   then verify approval, token redemption, and logout.

Local regression commands:

```sh
pnpm typecheck
pnpm typecheck:admin
pnpm -C packages/cli run typecheck
TZ=UTC pnpm -C apps/core exec vitest run src/modules/auth --maxWorkers=2
TZ=UTC pnpm -C apps/core exec vitest run src/utils/secret-storage-compatibility.spec.ts src/database/protect-stored-secrets.spec.ts --maxWorkers=2
TZ=UTC pnpm -C packages/e2e exec vitest run test/auth-login-state.test.ts test/auth-device-flow.test.ts --maxWorkers=1
pnpm -C apps/core run bundle
pnpm -C apps/admin run build
pnpm audit --json
```

The authentication E2E harness uses isolated PostgreSQL databases and Redis.
Social-provider and authenticator credentials are required for the final
production-origin social-login and Passkey checks.

## Upstream references

- [Better Auth 1.7 upgrade guide](https://www.better-auth.com/docs/guides/1-7-upgrade-guide)
- [Better Auth 1.7.16 security fixes](https://github.com/better-auth/better-auth/releases/tag/v1.7.16)
- [Account schema correction in 1.7.3](https://better-auth.com/blog/1-7-account-schema)
- [OAuth state / Magic Link isolation](https://github.com/advisories/GHSA-965c-763c-88jm)
- [OAuth Proxy isolation](https://github.com/advisories/GHSA-r4xp-prcw-77qf)
- [PostgreSQL rate limiting](https://github.com/advisories/GHSA-44jh-23m7-hpcf)
