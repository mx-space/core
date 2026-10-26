## TL;DR

Opening a published post in the editor without changing anything no longer marks it as changed or puts it in the draft inbox.

## Changes

- Opening a published post and leaving without edits keeps it in sync: no "changed" badge, no draft inbox entry, and it is not counted as having unpublished changes ([908a4e6](https://github.com/mx-space/core/commit/908a4e6d90bf702b8a16486fde1ae9f0087b9136)).
- Content entering the collaborative editor now carries block ids, so the editor no longer rewrites a post on load; restores and saves keep the ids of blocks they do not change ([4ccae74](https://github.com/mx-space/core/commit/4ccae74f945938b1f4bec5a43a1120bb14b425aa)).
- Posts opened before this release are repaired once by a migration that runs in the release phase; open editors reload on reconnect ([908a4e6](https://github.com/mx-space/core/commit/908a4e6d90bf702b8a16486fde1ae9f0087b9136)).
- A field save that changes nothing no longer marks the draft as edited ([908a4e6](https://github.com/mx-space/core/commit/908a4e6d90bf702b8a16486fde1ae9f0087b9136)).
- The draft history no longer shows a duplicate "system" step next to "started collaborative editing" ([d5653a7](https://github.com/mx-space/core/commit/d5653a7fa6a0861a2a9c06779b9f6afef1669e72)).
- Editor packages updated to haklex 0.58.0 ([c15af2f](https://github.com/mx-space/core/commit/c15af2f4d4a2781a5fbeb544fb9e9b2e8ecb8082)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.6.0...v15.6.1
