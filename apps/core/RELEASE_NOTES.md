## TL;DR

Fixes S3 storage settings being dropped on save, restores serving of files in nested upload folders, and cuts cold-start time by roughly 20%.

## Changes

- S3 storage credentials and options now survive a settings save instead of being reset to defaults, so object-storage uploads keep working after any configuration change ([#2780](https://github.com/mx-space/core/pull/2780))
- Files stored inside nested directories under the upload root are served correctly again instead of returning a not-found error ([#2780](https://github.com/mx-space/core/pull/2780))
- Server startup is noticeably faster — a fresh container now reaches ready in about 430ms, down from ~530ms, thanks to a shipped V8 compile cache and deferring heavy dependencies until they are actually used ([2afacbb](https://github.com/mx-space/core/commit/2afacbbc0cf043c17e8b5e5110ff75c7d76a07a9))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.20.0...v13.20.1
