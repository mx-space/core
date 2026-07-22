## TL;DR

Fixes a bug that broke membership checkout, status, and admin grant/revoke for real readers.

## Changes

- Fixed membership checkout, status lookup, comment-list membership badges, and admin manual grant/revoke throwing `Invalid EntityId format` for real readers — reader IDs are Better Auth text IDs, not Snowflake IDs, and were incorrectly validated as the latter. ([#2774](https://github.com/mx-space/core/issues/2774))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.16.1...v13.16.2
