## TL;DR

Swaps the `stock_bars` serverless built-in from Twelve Data to Polygon.io after Twelve Data moved hourly intraday for individual symbols behind its Grow/Venture plan.

## Changes

### Bug Fixes

- **stock**: rewrite `stock_bars` against the Polygon.io aggregates endpoint (`/v2/aggs/ticker/.../range/{mult}/{span}/{from}/{to}`); display meta (exchange, name, currency) is now resolved through `/v3/reference/tickers/{sym}` with a 24h cache. A new `thirdPartyServiceIntegration.polygon` config section (Settings → Third-party integrations) holds the API key. The wire shape (`{ meta, bars }`), cache key, and TTLs are unchanged, so `@mx-space/api-client` and `apps/admin` need no updates ([c72cd47](https://github.com/mx-space/core/commit/c72cd47bdebdf29f75efc728135f77ca117d3c2d)).

## Upgrade Notes

After upgrading, open Settings → Third-party integrations → **Polygon.io**, enable it, and paste a Polygon.io API key (the free tier covers 5 req/min and 2 years of history, which is sufficient for the rich-editor stock K-line block). The legacy **Twelve Data** field is retained for `stock_quote`, which still uses Twelve Data and will be migrated in a follow-up release.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.7...v13.11.8
