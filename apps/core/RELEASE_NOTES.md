## TL;DR

Live Desk is now available by default on supported Core deployments, without a redundant server environment flag.

## Changes

- Enabled Companion Live Desk automatically and removed the server-side feature gate, so pairing and public Presence no longer depend on `COMPANION_LIVE_DESK_ENABLED` ([9a22898](https://github.com/mx-space/core/commit/9a22898932cc1ce010e8c024d2401687cc1e60c3)).
- Updated Admin to read the public Live Desk projection and permit pairing independently from capability metadata loading ([9a22898](https://github.com/mx-space/core/commit/9a22898932cc1ce010e8c024d2401687cc1e60c3)).
- Operators may remove the obsolete `COMPANION_LIVE_DESK_ENABLED` setting; no replacement configuration is required.

**Full Changelog**: https://github.com/mx-space/core/compare/v13.13.0...v13.13.1
