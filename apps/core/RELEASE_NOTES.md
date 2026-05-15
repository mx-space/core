## TL;DR

Recently entries now resolve a link card for every URL in their body, and the deprecated typed-entry kinds have been removed.

## Highlights

Recently (碎语) entries previously carried at most one enriched link. They now expose a URL-keyed enrichment map built the same way posts, notes and pages already work — the server scans the entry body and resolves a card for each link it finds. An entry that references several links gets a card for each, and enrichment is attached fresh on every read from the enrichment cache instead of being stored per row.

The legacy typed recently kinds — `book`, `media`, `music`, `github`, `academic`, `code` — have been retired. `RecentlyTypeEnum` now only distinguishes `text` and `link`, and the type is derived server-side from whether the body contains a URL. The per-type metadata schemas and the discriminated-union create/update DTO are gone; creating an entry now only needs `content`.

## Changes

### Features

- Recently entries resolve a link card per URL through a URL-keyed enrichment map, replacing the single per-entry enrichment. ([#2726](https://github.com/mx-space/core/pull/2726))
- Deprecated typed recently entries (book/media/music/github/academic/code) removed; `RecentlyTypeEnum` collapses to `text`/`link`. ([#2726](https://github.com/mx-space/core/pull/2726))

## Upgrade Notes

- An app-migration drops the `recentlies.enrichment_provider` and `recentlies.enrichment_external_id` columns automatically on startup — no manual action required.
- The recently API response shape changed: `enrichment` / `enrichmentExternalId` / `enrichmentProvider` are replaced by an `enrichments` map. Custom frontends that read recently entries should move to `@mx-space/api-client` 4.2.0; the bundled dashboard (mx-admin 7.3.0) already matches.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.6.0...v12.7.0
