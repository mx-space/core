## TL;DR

Admin write surface gains mx-editor LiteXML authoring, and Lexical write APIs now require `content` and `text` to be submitted together.

## Highlights

The admin write panel now accepts LiteXML envelopes (`<mxpost>`, `<mxnote>`) as a first-class authoring format. Content is parsed into Lexical JSON on submit, so the server-side storage shape is unchanged — operators see the same lexical content rows, with a richer authoring loop on the admin side via `@haklex/rich-litexml`.

Server-side validation for lexical writes is tightened: `content` (Lexical JSON) and `text` (plain-text projection) must now be sent as a pair. Creates require both; partial updates accept neither or both, never one alone. This prevents stale `text` from drifting out of sync with `content` after a write, which previously could happen when callers patched only one side.

## Upgrade Notes

If you have any external integrations that POST/PATCH lexical posts, notes, or pages directly to the server, update them to submit `content` and `text` together. The official `@mx-space/api-client` v5.3.1 (published alongside this release) and admin are already aligned. Clients sending only `content` (or only `text`) for `contentFormat: lexical` writes will now receive a 400 `VALIDATION_FAILED`.

## Changes

### Features
- Admin rich editor: author posts in LiteXML (`<mxpost>`, `<mxnote>`) — parsed to Lexical on submit ([#2743](https://github.com/mx-space/core/pull/2743))
- Lexical write validation: enforce paired `content` + `text` submission across post / note / page / draft ([#2743](https://github.com/mx-space/core/pull/2743))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.5.2...v13.6.0
