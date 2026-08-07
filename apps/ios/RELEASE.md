# iOS TestFlight release

CI: `.github/workflows/mobile-testflight.yml` generates the Xcode project,
runs the API contract and SpaceCore tests, archives Space, and uploads it to
App Store Connect.

## Trigger

- A push to any branch runs the workflow only when `apps/ios/**` changed.
- `workflow_dispatch` supports an explicit release from any selected ref after
  the workflow exists on the default branch.

## GitHub Actions secrets

| Secret | Value |
| --- | --- |
| `IOS_DIST_CERT_P12` | Base64-encoded Apple Distribution `.p12` |
| `IOS_DIST_CERT_PASSWORD` | Password used to export the `.p12` |
| `IOS_SPACE_APPSTORE_PROFILE` | Base64-encoded App Store profile for `dev.innei.space` with Push Notifications |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_API_KEY_P8` | Raw App Store Connect API private key |

The Apple Team ID is `KAMM5N88X3`. The workflow validates the profile team,
bundle identifier, distribution type, and production APNs entitlement before
archiving.

## App Store Connect

Create the iOS app record for bundle ID `dev.innei.space` before the first
upload. The workflow uses `GITHUB_RUN_NUMBER` as the build number and keeps the
marketing version in `project.yml`.

The open-source build leaves `SPACE_PUSH_RELAY_URL` empty, so Notifications are
hidden until the official relay is configured and verified separately.
