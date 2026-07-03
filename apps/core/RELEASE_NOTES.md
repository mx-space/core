# v13.11.11

## TL;DR

Fixes logged-in reader avatars never showing up in the web presence timeline, and switches Better Auth row ids to digit-only snowflake ids.

## Changes

- Reader avatars in the presence timeline (`GET /activity/presence`) work again: the snake_case response pass was mangling mixed-case reader ids used as keys of the `readers` map (`aB3x…` → `a_b3x…`), so clients could never match `presence.readerId` back to a reader and avatars fell back to the anonymous dot. The `presence` and `readers` subtrees are now emitted verbatim, which fixes lookups for all existing readers regardless of id shape ([d366de1](https://github.com/mx-space/core/commit/d366de18b))
- Better Auth now generates digit-only snowflake ids for its rows (readers, sessions, accounts, api keys, …) via the app-wide `SnowflakeService`, replacing the default 32-char mixed-case random ids that are hostile as record keys under case transforms and inconsistent with the ids used everywhere else. The remaining `randomUUID()` row ids in `AuthService` (owner registration, `saveToken`) were switched too. Key material and session tokens keep their own random generators, so nothing security-sensitive changes ([2aa0771](https://github.com/mx-space/core/commit/2aa077183))

Existing readers keep their current ids — the presence fix covers them without any migration.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.10...v13.11.11
