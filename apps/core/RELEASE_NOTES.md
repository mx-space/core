## TL;DR

Patch on top of v14: closes a private-note data leak in the activity feed, fixes S3 uploads, and improves the admin snippet editor.

## Changes

- Last-year publication feed no longer returns private note bodies — only public metadata for published, password-free notes ([#2803](https://github.com/mx-space/core/pull/2803))
- S3 uploads no longer send an explicit content length with fetch, fixing failures on some providers, and transport errors now log sanitized diagnostics ([#2797](https://github.com/mx-space/core/pull/2797))
- Admin snippet editor keeps JSON readable after save ([#2806](https://github.com/mx-space/core/pull/2806))
- Dependency updates: nanoid v5 and brace-expansion security ranges

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.0.0...v14.0.1
