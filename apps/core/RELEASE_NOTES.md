## TL;DR

V3 API contract ships — list endpoints now return `{ data, meta }` with snake_case fields and named views, replacing the legacy V2 wire shape.

## Breaking Changes

- **api: V3 response envelope replaces V2 wire shape**. All list endpoints now return `{ data, meta }`. Pagination, translation, enrichments, related, and insights move from inline top-level keys into `meta.*` (e.g. `meta.pagination`, `meta.translation`, `meta.enrichments`). Field naming is snake_case end-to-end. Each list endpoint exposes a named view (`card` for collections, `detail` for single-item endpoints) so consumers can ask for the projection they actually need. **Migration**: upgrade `@mx-space/api-client` to v5 — its legacy adapter reconstructs the V1 wire shape for older callers (camelCase, flattened meta, V1 pagination keys) so existing code keeps working while you migrate readers off the legacy adapter. Direct HTTP consumers must read pagination from `meta.pagination` and translation/enrichment metadata from `meta.*` instead of the top-level object.

## Highlights

The response contract is the headline change. The previous V2 shape leaked translation, enrichment, and pagination state into the top-level payload, which made the wire format ambiguous (is this field part of the resource, or platform metadata?) and forced every consumer to know which fields were "real." V3 splits resource fields from platform metadata cleanly: `data` is the resource (or array of resources), and everything platform-injected lives under `meta`. Snake_case removes the mixed-case quirk inherited from the Mongo era, and named views (`card`/`detail`) let endpoints declare their projection instead of having callers guess.

Article detail handlers (post/page/note) now always emit translation meta, even when the article has no translation. V1 consumers previously had to special-case the missing `is_translated` / `source_lang` / `available_translations` fields; they're now present by default so the language picker and source-language badge render unconditionally.

`@mx-space/api-client` v5 ships alongside this release with a legacy adapter that converts V3 envelopes back to the V1 wire shape (camelCase, flattened meta, `currentPage`/`totalPage` pagination, `hasNextPage`/`hasPrevPage` flags). The adapter is transparent — existing callers using the V1 client surface keep working without changes — but it's a compatibility layer, not the future. New code should use the V3 envelope directly.

Logging output gets a more concise format. Request lines now show direction arrows (`→` / `←`), the response status code, and the elapsed milliseconds in one compact line, replacing the previous `+++ Request received` / `--- Response sent` pair.

## Changes

### Refactors
- V3 response envelope, snake_case schema, named views ([#2729](https://github.com/mx-space/core/pull/2729))
- Request/response logging interceptor — compact single-line format with status code and timing ([2e70a8a](https://github.com/mx-space/core/commit/2e70a8a2))

## Upgrade Notes

- Bump `@mx-space/api-client` to **v5.x** in any direct consumer. The legacy adapter is the migration bridge; ship it first, then migrate readers off it endpoint-by-endpoint.
- Direct HTTP / REST consumers (no api-client): read pagination from `meta.pagination` (`page`, `size`, `total`, `total_pages`) and translation/enrichments/related/insights metadata from `meta.*`. Field names are snake_case throughout.
- Article detail endpoints (post/page/note) now always emit `is_translated`, `source_lang`, and `available_translations` — if your consumer was guarding on their absence, the guard is dead code and can be removed.
- Self-hosted admin operators: dashboard pin is bumped to **v8.0.0** — deploy the matching mx-admin release.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.10.0...v13.0.0
