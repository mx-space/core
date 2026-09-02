## TL;DR

Import GitHub sponsors as memberships in one click, runtime moves to NestJS 12, and republishing no longer bumps modification time spuriously.

## Highlights

**GitHub sponsor import.** The admin Readers page now has an import modal that lists your GitHub sponsors matched against readers who linked a GitHub account, and grants each of them a chosen number of months of membership. Readers with an active manual grant get the new period appended to their current end date instead of overwritten, so existing sponsors never lose time.

**NestJS 12 runtime.** The server has been upgraded from NestJS 11 to 12 and the `nestjs-zod` layer replaced with Nest's native Standard Schema validation. Request validation, the `422 VALIDATION_FAILED` error envelope, WebSocket handshakes, and the migration runner all behave as before. Docker images bundle the required Node version; source installs now need Node 22.12 or newer.

**Accurate modification time.** Republishing a post or note previously refreshed `modifiedAt` even when only editor block IDs or unrelated metadata changed. The server now hashes title, body, summary, tags, and format, and only bumps the timestamp when that content identity actually differs.

## Changes

### Features
- Import GitHub sponsors as manual memberships via `GET`/`POST /membership/sponsors/github` and the admin Readers import modal ([50c6f23](https://github.com/mx-space/core/commit/50c6f23c817b7a659903cb03d93720af3589aca5))
- Upgrade to NestJS 12 with Standard Schema validation; `nestjs-zod` removed ([#2814](https://github.com/mx-space/core/pull/2814))

### Bug Fixes
- `modifiedAt` only changes when title, body, summary, tags, or format change ([e61633f](https://github.com/mx-space/core/commit/e61633f9843c78bccf14126d84ba700d657eecdb))
- WebSocket gateway no longer runs HTTP guards and interceptors on socket messages, restoring `ping` and `room.join` acks ([#2814](https://github.com/mx-space/core/pull/2814))

### Other
- Admin dashboard bumped to 8.4.23: Readers list actions moved into the header, tighter detail header spacing.

## Upgrade Notes

- Source and CLI installs require Node 22.12+. Docker deployments need no action.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.6.1...v14.7.0
