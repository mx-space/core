## TL;DR

Articles can now be narrated block-by-block with AI-generated audio, complete with an admin management surface and entitlement-aware public playback.

## Highlights

AI Text-to-Speech turns any post, note, or page into a spoken version, synthesized one content block at a time through any OpenAI-compatible speech endpoint. Each block is stored as a content-addressed audio object, so unchanged text is reused across regenerations and only stale segments are re-synthesized — keeping repeat runs fast and cheap. Narration availability is advertised on every article detail response via a `tts` meta flag, so frontends can surface a play control only when audio actually exists.

Reader access mirrors the existing paywall exactly. The public narration endpoint runs the same membership and password checks as article visibility, so premium content is gated consistently whether a reader is hitting text or audio. Site owners, active members, and entitled readers get playback; everyone else sees narration as unavailable, with no leak through the shared cache.

On the admin side, a generation panel inside the editor and a dedicated fleet management page cover the full lifecycle: enqueue or force-regenerate per article or in bulk, inspect segments on a timeline, resolve titles across the whole list, and delete with storage cleanup. AI quick-action entries are also added to the Note and Post context menus alongside summary, insights, and translation.

## Changes

### Features
- **ai-tts:** per-block AI narration for articles ([#2781](https://github.com/mx-space/core/pull/2781)) — configurable OpenAI-compatible speech provider, content-addressed reuse, public entitlement-aware playback, `tts` article meta, and a full admin generation/management surface.

### Bug Fixes
- **migration:** corrected an out-of-order timestamp on the `0028_ai_tts` migration so the boot-time schema-currency check detects drift correctly ([c3ff266](https://github.com/mx-space/core/commit/c3ff266ba0c0c3a4d73e6b282873f54a8ce6e54f))

## Upgrade Notes

No manual operator action required. The `0028_ai_tts` migration applies automatically via the normal `migrate.mjs` release step; its timestamp correction only affects the recorded `created_at` on fresh applies and does not change SQL execution order or any migration hash.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.22.0...v13.23.0
