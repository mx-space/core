# Better Auth 1.7 security upgrade

This release upgrades `better-auth`, its core, adapters, and the API Key, Expo,
and Passkey plugins from 1.6.27 to 1.7.14. Core, Admin, and CLI consumers use the
same release through the workspace overrides.

## Security scope

The old dependency graph matched six Better Auth advisory entries, covering
device approval, OAuth state / Magic Link isolation, OAuth Proxy, and PostgreSQL
rate limiting. The updated graph has no Better Auth advisory matches in
`pnpm audit`. Other packages reported by a full workspace audit are outside this
upgrade.

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
TZ=UTC pnpm -C apps/core exec vitest run src/modules/auth --maxWorkers=2
TZ=UTC pnpm -C packages/e2e exec vitest run test/auth-login-state.test.ts test/auth-device-flow.test.ts --maxWorkers=1
pnpm audit --json
```

The authentication E2E harness uses isolated PostgreSQL databases and Redis.
Social-provider and authenticator credentials are required for the final
production-origin social-login and Passkey checks.

## Upstream references

- [Better Auth 1.7 upgrade guide](https://www.better-auth.com/docs/guides/1-7-upgrade-guide)
- [Account schema correction in 1.7.3](https://better-auth.com/blog/1-7-account-schema)
- [OAuth state / Magic Link isolation](https://github.com/advisories/GHSA-965c-763c-88jm)
- [OAuth Proxy isolation](https://github.com/advisories/GHSA-r4xp-prcw-77qf)
- [PostgreSQL rate limiting](https://github.com/advisories/GHSA-44jh-23m7-hpcf)
