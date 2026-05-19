## TL;DR

Patch release fixing device-login verification links and making schema migrations idempotent across branch switches so redeploys no longer fail.

## Changes

- `mxs auth login` now shows a device verification link on the same host you pointed the CLI at, rather than a fixed configured URL — the link and the API base stay consistent. ([a904013](https://github.com/mx-space/core/commit/a904013a1a1b468551af4451ed575ef214981647))
- Schema migrations are now matched by content hash instead of a single timestamp watermark, so switching or rebasing branches no longer re-runs an already-applied migration and fails the deploy with `relation "..." already exists`. ([d1668db](https://github.com/mx-space/core/commit/d1668db9384b06efa3426db780a538dcb97a32fc))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.9.1...v12.9.2
