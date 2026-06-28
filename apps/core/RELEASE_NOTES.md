## TL;DR

Patch release ships a built-in stock-data primitive: two cached serverless functions (`stock_quote`, `stock_bars`) backed by Twelve Data, plus the admin Lexical decorator node and insert dialog that authors compose with. Also picks up an admin login state refresh.

## Changes

- **stock:** Built-in serverless `stock_quote` and `stock_bars` snippets fetch from Twelve Data and cache in Redis (60s for live quotes, one year for frozen historical ranges). API key managed under `Settings → Third-party integrations → Twelve Data`. ([00a8f86](https://github.com/mx-space/core/commit/00a8f86fc))
- **admin:** New Lexical decorator node under `vendor/rich-editor/extensions/stock/` with a single slash-menu entry, variant-aware insert dialog, vertically stacked From/To inputs, and live debounced preview. ([00a8f86](https://github.com/mx-space/core/commit/00a8f86fc))
- **admin:** Refresh auth state after login so cached identity reflects the new session. ([068b545](https://github.com/mx-space/core/commit/068b545d5))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.3...v13.11.4
