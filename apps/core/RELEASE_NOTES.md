## TL;DR

Fixes large file uploads (videos and other multi-part files) failing on Cloudflare R2 and other strict S3-compatible storage backends.

## Changes

- Large streamed uploads no longer fail with `InvalidPart: All non-trailing parts must have the same length`. Multipart parts are now sliced to a fixed 8 MB size instead of varying with network chunk boundaries, which Cloudflare R2 requires for all non-trailing parts. ([a39b24f](https://github.com/mx-space/core/commit/a39b24f57c0bb0d593f9bac7a6ddbb438218ee79))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.10.2...v13.10.3
