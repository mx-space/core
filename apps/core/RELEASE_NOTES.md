## TL;DR

Comment moderation now decides most submissions instantly with a decision model, and visitors can see whether their comment was published, held, or rejected.

## Highlights

Comment review now runs in two stages. When "Prefer decision model" is enabled, a fast decision model judges each guest comment within about a second and publishes or rejects the clear cases immediately. Comments it is unsure about, or that time out, go to the existing LLM review in the background; after repeated failures they wait for the site owner. The confidence threshold and timeout are configurable in comment settings.

Visitors now get a real answer after submitting. The submission response reports whether the comment was published, is pending, or was rejected, together with a private receipt. With that receipt, the author can later ask for the current status, and a pending result also says whether it is waiting on automatic review, which usually finishes in seconds, or on the site owner.

The bundled admin can now combine several GPX files into one map, with each file drawn as a separate leg that has its own title and order.

## Changes

### Features

- Two-stage comment moderation: a decision model settles clear cases instantly, and uncertain ones fall back to background LLM review, then owner review ([#2826](https://github.com/mx-space/core/pull/2826))
- Comment submissions return their moderation status and a private receipt, and `POST /comments/:id/moderation` returns the current status for that receipt ([#2826](https://github.com/mx-space/core/pull/2826))
- Pending submissions report whether they wait on automatic review or on the site owner ([0f1eb29](https://github.com/mx-space/core/commit/0f1eb2992b4a98aeab876ce61c8b2ce634916113))
- The admin map editor can combine several GPX files into one map as separate legs ([#2826](https://github.com/mx-space/core/pull/2826))
- The sponsor archive now includes each item's category name ([edb896b](https://github.com/mx-space/core/commit/edb896b10b2488ce40c6ef1bab387c31994bb456))

### Bug Fixes

- Comments marked as junk no longer appear in the homepage's recent activity ([#2825](https://github.com/mx-space/core/pull/2825))
- Comments from signed-in readers stay public when audit mode is on ([#2826](https://github.com/mx-space/core/pull/2826))

## Upgrade Notes

This release adds migration `0040_comment_moderation`, which adds three nullable or defaulted columns to `comments`. Run it before starting the new version; the server refuses to boot on an outdated schema. Docker Compose deployments that include the `mx-migrate` service run it automatically.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.13.0...v14.14.0
