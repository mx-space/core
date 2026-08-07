# mx-space Push Relay

Push Relay is an independently deployable, open-source boundary between a
self-hosted mx-core instance and Apple Push Notification service (APNs). It
does not accept raw mx-core Webhook payloads. The only v1 event projection is
the comment resource identifier; comment text, author, email, IP address and
user agent never enter this service.

## Configuration

| Variable                  | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `PUSH_RELAY_DATABASE_URL` | Dedicated PostgreSQL connection URL                    |
| `PUSH_RELAY_PUBLIC_URL`   | Public HTTPS origin, without a path                    |
| `PUSH_RELAY_DATA_KEY`     | 32-byte hex or Base64 key used for AES-256-GCM at rest |
| `PUSH_RELAY_APPS_JSON`    | App manifest array shown below                         |
| `PUSH_RELAY_PORT`         | HTTP port, default `8787`                              |

```json
[
  {
    "id": "space",
    "bundleId": "dev.innei.space",
    "teamId": "APPLE_TEAM_ID",
    "keyId": "APNS_KEY_ID",
    "privateKeyPath": "/run/secrets/AuthKey_APNS.p8"
  }
]
```

The APNs key and trusted topic are server configuration. Neither is supplied
by mx-core or a mobile client. A fork can use its own app ID, bundle ID and
APNs key without changing the wire protocol.

Run `pnpm --filter @mx-space/push-relay db:migrate` before starting the relay.

## mx-core configuration

Push activation stores a source credential in mx-core. The credential is
always protected by a dedicated AES-256-GCM envelope; activation is rejected
unless mx-core encryption is enabled:

```dotenv
MX_ENCRYPT_ENABLE=true
MX_ENCRYPT_KEY=<stable deployment secret>
```

The key must remain stable across restarts. Losing or rotating it without a
migration makes existing Push Relay sources unreadable; affected devices must
then be activated again.

## Local execution

From the repository root:

```sh
pnpm --filter @mx-space/push-protocol build
pnpm --filter @mx-space/push-relay db:migrate
pnpm --filter @mx-space/push-relay build
pnpm --filter @mx-space/push-relay start
```

Plain HTTP is accepted only for `localhost`, `127.0.0.1`, `::1`, and `.local`
development hosts. All other relay origins must use HTTPS.

## Container deployment

The image contains both production entry points and the SQL migration:

```sh
docker build -f apps/push-relay/Dockerfile -t mx-space-push-relay .
docker run --rm --env-file push-relay.env mx-space-push-relay \
  node dist/migrate.mjs
docker run --env-file push-relay.env -p 8787:8787 mx-space-push-relay
```

Mount the APNs `.p8` file read-only at the path declared in
`PUSH_RELAY_APPS_JSON`. In production, place the relay behind an HTTPS reverse
proxy and apply request-rate limits to installation registration and activation
ticket endpoints.

## Verification boundary

`pnpm --filter @mx-space/push-relay verify:local` validates registration,
single-use activation, signature verification, event idempotency, and the
generic payload against a running local relay. A real APNs delivery still
requires a matching Apple Team ID, Key ID, `.p8` key, App ID, signed physical
iPhone build, and device token; a simulator-only run cannot prove that boundary.
