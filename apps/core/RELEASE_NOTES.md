## TL;DR

Enrichment images now expose three role-specific fields — thumbnail, preview, capture — and GitHub previews ship with blurhash + dominant color extracted automatically.

## Highlights

The enrichment surface is now organized around display roles rather than provider quirks. The square card thumbnail (`thumbnailImage`), the wide hover preview (`previewImage`), and the puppeteer page capture (`captureImage`) each have a clearly-assigned slot, and all three share the same `EnrichmentImage` shape with optional `blurhash`, `palette`, width, height, and alt text. Frontends no longer need to fall back across types — they pick the field that matches their surface.

GitHub enrichment now fetches the OpenGraph hero image and the owner/author avatar in parallel during cache-miss, extracts blurhash and dominant color via a new `ImageMetaService`, and merges them into `previewImage` and `thumbnailImage` respectively. The OG URL itself is GitHub's auto-generated `opengraph.githubassets.com/<token>/<owner>/<repo>[/...]` (1280×640), with the cache token derived from the entity's mutation timestamp so the preview invalidates on update. Failure is silent — if the fetch times out or 404s, the URL is preserved but hash fields are absent.

## Changes

### Features
- Enrichment results expose `thumbnailImage`, `previewImage`, and `captureImage`; the underlying `EnrichmentImage` shape carries an optional `palette` ([#2734](https://github.com/mx-space/core/pull/2734))
- GitHub providers populate `previewImage` with the auto-generated OpenGraph hero URL and fetch blurhash + palette for both the avatar and the preview ([#2734](https://github.com/mx-space/core/pull/2734))

## Upgrade Notes

Migration `0014_enrichment_captures.sql` renames the `enrichment_screenshots` table to `enrichment_captures` and rewrites the `image` / `screenshot` JSONB keys in existing `enrichment_cache.normalized` rows to `thumbnailImage` / `captureImage`. Under rolling deploy with two replicas, drain old replicas before applying the migration to avoid `relation does not exist` errors on the capture endpoints during the rollout window. Existing GitHub cache rows gain `previewImage` and `blurhash` naturally as their TTL expires; force-invalidate with `DELETE FROM enrichment_cache WHERE provider LIKE 'gh-%'` to refresh immediately.

The required dashboard version is bumped to 7.4.0 — self-hosted admin operators should deploy the new admin release.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.9.5...v12.10.0
