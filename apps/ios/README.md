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

| Command | Effect |
|---|---|
| `make project` | regenerate `Space.xcodeproj` from `project.yml` |
| `make build` | build the app for the simulator |
| `make test` | SpaceCore on the host, SpaceUI on a simulator |
| `make contract` | verify `openapi.json` matches the server manifest |
| `make verify` | end-to-end pairing run against a live instance |

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
