# Space — iOS admin client

Native client for a self-hosted mx-core instance. iOS 26+, UIKit shell with
SwiftUI leaf screens.

Design: `docs/superpowers/specs/2026-08-05-ios-admin-app-design.md`

## Layout

```
apps/ios/
├─ project.yml               XcodeGen source of truth; Space.xcodeproj is generated
├─ Space/                    app target — composition root, tab bar, scene setup
└─ Packages/
   ├─ SpaceCore/             generated OpenAPI client, auth middleware, Keychain
   └─ SpaceUI/               design tokens and the three Liquid Glass components
```

`Space.xcodeproj` is not committed. Run `make project` after cloning or after
editing `project.yml`.

## Commands

| Command         | Effect                                            |
| --------------- | ------------------------------------------------- |
| `make project`  | regenerate `Space.xcodeproj` from `project.yml`   |
| `make build`    | build the app for the simulator                   |
| `make test`     | SpaceCore on the host, SpaceUI on a simulator     |
| `make contract` | verify `openapi.json` matches the server manifest |
| `make verify`   | end-to-end pairing run against a live instance    |

Override the simulator with `make test SIMULATOR="iPhone 17"`.

## End-to-end verification

`make verify` drives the real first-run path on a simulator against a running
mx-core. `scripts/approve-device.sh` stands in for the operator's browser
approval: it signs in as the owner, waits for a pending `space-ios` code, opens
the verification page to claim it (the server refuses an approval from a session
that has not), and approves.

```
PG_URL="postgres://mx:mx@127.0.0.1:5433/mx_verify" NODE_ENV=production \
  REDIS_HOST=127.0.0.1 REDIS_PORT=6380 SNOWFLAKE_WORKER_ID=7 \
  JWT_SECRET=<32+ chars> PORT=2444 node ../core/out/main.mjs

make verify SPACE_SERVER=http://127.0.0.1:2444 \
            SPACE_USERNAME=<owner> SPACE_PASSWORD=<password> \
            PG_DATABASE=mx_verify
```

The suite skips itself when `SPACE_TEST_SERVER` is unset, so `make test` stays
green without a server.

## Code signing

The app is signed locally (`CODE_SIGN_IDENTITY = "-"`) with
`Space/Space.entitlements`. This is not cosmetic: the Keychain refuses
`SecItemAdd` without an `application-identifier` entitlement, and an unsigned
simulator build has none — pairing silently fails to persist its token.

## Push notifications

Push is an optional build capability. When `SPACE_PUSH_RELAY_URL` is empty, the
Notifications entry is omitted from the site menu. This keeps an unconfigured
self-built app functional without exposing a control that cannot succeed.

| Build setting               | Meaning                                               |
| --------------------------- | ----------------------------------------------------- |
| `SPACE_PUSH_RELAY_URL`      | HTTPS origin of the independently deployed Push Relay |
| `SPACE_PUSH_APP_ID`         | Relay manifest key; defaults to `space`               |
| `SPACE_APNS_ENVIRONMENT`    | `development` for Debug, `production` for Release     |
| `PRODUCT_BUNDLE_IDENTIFIER` | Must match the APNs topic configured on the relay     |

A custom fork supplies its own bundle identifier, Apple App ID, Team ID, APNs
Key ID, and `.p8` key. These values are deployment identity, not user-entered
runtime settings. The official build may set its relay origin and app identity
as fixed build settings; the open-source source tree intentionally keeps the
relay origin empty by default.

The app stores only its installation credential in Keychain. mx-core stores a
different source credential, and the relay alone stores the APNs key and device
token ciphertext. Notification previews are generic and never contain comment
text or visitor information.

The `aps-environment` entitlement must be signed by a provisioning profile that
supports Push Notifications. End-to-end APNs verification therefore requires a
physical iPhone and matching Apple credentials; the simulator build validates
the client path but not Apple delivery.

## API contract

`Packages/SpaceCore/Sources/SpaceCore/openapi.json` is generated — never edit
it. It is written by `pnpm -C apps/core run openapi:export`, which emits the
same bytes to `apps/core/openapi.json` and here. `openapi:check` fails if
either copy drifts.

swift-openapi-generator turns it into `Types.swift` / `Client.swift` at build
time via the SPM build-tool plugin. That plugin has no interactive trust prompt
in a headless build, so every `xcodebuild` invocation passes
`-skipPackagePluginValidation`.

To add an endpoint: register it in
`apps/core/src/common/openapi/route-manifest.ts`, re-export, rebuild.

## Transport policy

`ServerEndpoint` refuses plaintext HTTP for public hosts and allows it only for
`localhost`, `*.local`, and RFC1918 addresses — matching the
`NSAllowsLocalNetworking` exception in `Info.plist`. `NSAllowsArbitraryLoads`
is deliberately absent; enabling it invites an App Review question.
