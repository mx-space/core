## TL;DR

Four AI/admin fixes — custom provider endpoints now honored, orphan articles surface in grouped lists, translation glossary scans every note, and `/recently` writes hydrate link-card enrichments.

## Highlights

The AI provider runtime now honors the `endpoint` configured in the admin drawer even when a registered OpenAI-compatible model matches the request. Previously, a model id like `gpt-4o-mini` would always route through `api.openai.com` regardless of the saved endpoint, breaking proxy and relay deployments and causing `403 Country/Region not supported` errors in restricted regions. The admin `getAiProviderById` lookup also stops returning the encrypted ciphertext to the runtime — test-connection and model-list paths now see the decrypted value.

Admin AI panels now show every article, not only those that already have AI records. The grouped lists for summary, insights, and translation merge orphan articles — visible posts/notes that have never been processed (typical after DB-direct writes, migration backfills, or scripted imports) — alongside the records-having groups, with cross-page slicing and search filter propagating through both sides. The translation glossary collector also stops capping at the most recent 100 notes; a single distinct-value query now seeds mood/weather entries from every visible note in history.

The `/recently` write path now runs link-card enrichment on create and update, so cards no longer come back blank for URLs that the optimistic write didn't pre-resolve.

## Changes

### Bug Fixes
- AI runtime honors custom provider endpoints; `getAiProviderById` resolves through the decrypted cache so test-connection no longer sees encrypted API keys ([29e082a](https://github.com/mx-space/core/commit/29e082ad7ad9092603b8b5c1ead4c4c46c6236fe))
- Summary / insights / translation `/grouped` admin endpoints include orphan articles with zero AI records ([e51621a](https://github.com/mx-space/core/commit/e51621afd535c8b4c337d00e0ef82b061ed45c91), [#2758](https://github.com/mx-space/core/issues/2758))
- Translation glossary seeds from every visible note's mood/weather, not just the last 100 ([49aa04f](https://github.com/mx-space/core/commit/49aa04f17120596f1e29582695a6c9b1aa209cdf), [#2758](https://github.com/mx-space/core/issues/2758))
- `/recently` create/update hydrate link-card enrichments so cards survive the write path ([0c62e08](https://github.com/mx-space/core/commit/0c62e080680a8442194ea01d61178dba9e397cb4))

### Other
- Bump `@haklex/*` editor packages to 0.29.0 (Lexical 0.46 alignment; bundled — no operator action) ([806d0f7](https://github.com/mx-space/core/commit/806d0f7ec3b73bd4e16bf008b21c6fd0e6c41b5d))
- Workspace dependency refresh: Babel 8, sharp 0.35, nodemailer 9, js-yaml 5, NestJS 11.1.27 ([57a26e8](https://github.com/mx-space/core/commit/57a26e84f3b86b2caab2c3a3d4d8d3a02b5e3f24))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.1...v13.11.2
