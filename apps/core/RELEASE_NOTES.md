## TL;DR

Delivers the fixes v14.0.1 never shipped (its release run failed on a corrupted lockfile): a private-note data leak, S3 upload failures, and the admin snippet editor.

## Changes

- Last-year publication feed no longer returns private note bodies — only public metadata for published, password-free notes ([#2803](https://github.com/mx-space/core/pull/2803))
- S3 uploads no longer send an explicit content length with fetch, fixing failures on some providers, and transport errors now log sanitized diagnostics ([#2797](https://github.com/mx-space/core/pull/2797))
- Admin snippet editor keeps JSON readable after save ([#2806](https://github.com/mx-space/core/pull/2806))
- pnpm lockfile repaired after stale renovate rebases spliced duplicate keys into it, which made CI ignore the lockfile and resolve a mixed dependency graph ([34e437d](https://github.com/mx-space/core/commit/34e437d35b4e384ac47092eb05aefdac8bad4bab))
- Dependency updates: nanoid 5.1.16 and brace-expansion security ranges

v14.0.1 was tagged but its release pipeline failed before publishing; this release supersedes it.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.0.0...v14.0.2
