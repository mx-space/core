## TL;DR

This release restores hosted application icons in Live Desk and improves adjacent note navigation title reliability.

## Changes

- Live Desk now accepts any schema-validated HTTPS application icon URL without requiring a server environment allowlist. ([05853ef](https://github.com/mx-space/core/commit/05853efe5b82576c4228ce4d253bd020b7a81e1e))
- Adjacent note navigation now returns only required fields and uses cached translated titles, avoiding freshness mismatches that could leave neighboring titles untranslated. ([6a3ab51](https://github.com/mx-space/core/commit/6a3ab51911bf3f1dbdc99a51247e2c888cd912cc))

**Full Changelog**: https://github.com/mx-space/core/compare/v13.16.2...v13.16.3
