## TL;DR

AI translation moves to a new agent-powered pipeline, and the admin gains orphan-file reconciliation for cleaner storage.

## Highlights

**AI translation, rebuilt as an agent conversation.** The translation pipeline now runs on the message-engine agent loop: the translator writes and patches an in-memory virtual file through tools, a review sub-agent checks each segment window (monolingual first, then bilingual), and the whole run is driven by pi-agent-core. Benchmarked against the old pipeline, the agent path won on both test articles while main-thread prompt cache hits jumped from 7% to 57–86% — translation is not only better, it is also noticeably faster and cheaper. The lexical strategy automatically uses the agent runtime when the model supports it, with the legacy path retained otherwise.

**Orphan-file reconciliation.** The file manager now inventories how every upload is referenced across posts, notes and pages, so files that are no longer referenced by any content can be surfaced and cleaned up. A new admin view walks you through each orphan with a preview before you delete it, and the usage ledger is kept up to date as content changes.

**Richer editor, straight from the haklex 0.34 toolchain.** Gallery nodes gain aspect, fit and max-item-height controls, the slash menu supports nested items, and uploaded images insert back into the editor they were uploaded from. The code block also opens up: the full shiki language set (235 languages, including Swift) with free-form language input.

## Changes

### Features
- AI translation now runs as an append-only agent conversation: virtual-file patching, sub-agent review windows, per-target-language prompts, and site-level style hints ([#2782](https://github.com/mx-space/core/pull/2782))
- Generate covers from unsaved drafts, preferring the live editor title and summary over the published record ([b80610e](https://github.com/mx-space/core/commit/b80610ee773024bba30951eafbe3624128493056))
- File manager: reconcile isolated file references — inventory uploads, find orphans, and preview cleanup in a new admin view ([65736d7](https://github.com/mx-space/core/commit/65736d713be4eaf92717002c7e2a29709563dad6))
- Editor: gallery nodes gain aspect, fit and max-item-height controls ([07b4bb9](https://github.com/mx-space/core/commit/07b4bb923a3d8b0602b56663c265e5d6e5dca3d9))
- Editor: slash menu supports nested items ([07b4bb9](https://github.com/mx-space/core/commit/07b4bb923a3d8b0602b56663c265e5d6e5dca3d9))
- Editor: code block gains the full shiki language set with free-form language input ([1207b23](https://github.com/mx-space/core/commit/1207b23a6958491684e652c90dfdac2ef39468a7))

### Bug Fixes
- Editor: uploaded images now insert back into the editor they were uploaded from ([07b4bb9](https://github.com/mx-space/core/commit/07b4bb923a3d8b0602b56663c265e5d6e5dca3d9))
- Draft: the status tag no longer reports saves in the future ([b80610e](https://github.com/mx-space/core/commit/b80610ee773024bba30951eafbe3624128493056))

### Other
- Editor toolchain: lexical family lifted to 0.49.0 across direct pins and pnpm overrides ([8cb2f8f](https://github.com/mx-space/core/commit/8cb2f8f14bbe8b342483c01b669c9eb57ca2b3aa))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.20.1...v13.21.0
