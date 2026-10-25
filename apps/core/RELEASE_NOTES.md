## TL;DR

Lexical drafts now sync live through Loro with co-authors and an AI peer, and drafts gain storage management with cleanup and compaction.

## Highlights

Lexical drafts are now stored as one shared Loro document. Several editors can work on the same draft at once over the admin socket, see each other's carets and selections, and step back through a linear checkpoint timeline with restore and undo. HTTP sync remains the fallback whenever the socket is unavailable.

Owners can invite readers to co-author a document through an invite link. The AI writing agent edits the same document as its own peer, so its changes merge with human edits instead of overwriting them, and every step keeps its author in the history.

The drafts page shows how much storage each draft uses and whether it matches the published version. Drafts can be hard-deleted together with their collaboration data, compacted down to the latest content, or reclaimed in bulk from a cleanup dialog. An optional scheduled cleanup removes old history; drafts that differ from the published version are always kept.

## Changes

### Features

- Realtime collaborative editing of Lexical drafts on Loro, with presence, a checkpoint timeline, restore and undo ([#2870](https://github.com/mx-space/core/pull/2870))
- Co-author invitations and an AI agent that writes into the shared document as its own peer ([#2870](https://github.com/mx-space/core/pull/2870))
- Draft storage overview with per-draft size, relation to the published version, filters and sort ([88c3c69](https://github.com/mx-space/core/commit/88c3c690bc2d8b07c1ef6d8c542094d91245cc30))
- Hard delete, per-draft compaction and a bulk cleanup dialog that frees revision and collaboration storage ([88c3c69](https://github.com/mx-space/core/commit/88c3c690bc2d8b07c1ef6d8c542094d91245cc30))
- Optional scheduled draft cleanup under Settings → Storage, disabled by default ([88c3c69](https://github.com/mx-space/core/commit/88c3c690bc2d8b07c1ef6d8c542094d91245cc30))

### Bug Fixes

- LobeHub providers can be saved without an API key ([b58dc67](https://github.com/mx-space/core/commit/b58dc6746e744c2987dc8bf550e67a09d835d9da))
- The drafts list loads in a single query instead of several per draft, which cuts its response time and payload size ([88c3c69](https://github.com/mx-space/core/commit/88c3c690bc2d8b07c1ef6d8c542094d91245cc30))

## Upgrade Notes

This release adds database migrations, including `0046_draft_cleanup`. Run the release-phase migration (`mx-migrate`, or `pnpm -C apps/core run migrate`) before starting the new server; the server refuses to boot on an outdated schema.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.3.0...v15.4.0
