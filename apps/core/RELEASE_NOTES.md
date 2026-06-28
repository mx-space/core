## TL;DR

Patch release that unifies the Lexical runtime across the workspace, eliminating a latent duplicate-instance bug in the admin editor.

## Changes

- **deps:** Unify `lexical` and every `@lexical/*` subpackage to `^0.46.0` across `apps/admin`, `apps/core`, `packages/cli`, and `packages/editor`, and bump six stranded `@haklex/rich-plugin-*` pins from `0.28.0` to `0.29.0`. Before this fix, `pnpm install` allocated both `lexical@0.45.0` (satisfying the stranded plugins' peer floor) and `lexical@0.46.0` (satisfying the bumped editor family) in the admin install graph, which manifested at runtime as Lexical error #8 (`Cannot find node by key`) when inserting nodes whose class was registered against the other lexical heap. The admin editor now resolves a single `lexical@0.46.0` end-to-end. ([81cf2c5](https://github.com/mx-space/core/commit/81cf2c5c8))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.2...v13.11.3
