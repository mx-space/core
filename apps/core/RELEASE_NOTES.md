## TL;DR

Image placeholder hashes switch from blurhash to thumbhash across the stack, and AI translations now run through a writer → reviewer → editor pipeline for higher fidelity.

## Breaking Changes

- **Image placeholder format**: every image carries a `thumbhash` (lowercase, base64-encoded) field instead of `blurHash` / `blurhash`. The `enrichment_captures.blurhash` column is dropped; `images.blurHash` keys inside content JSONB are stripped; `enrichment_cache.normalized` shedded its embedded `*.blurhash` paths. Old hash strings are not migrated — legacy images fall back to the existing `accent` color block as a placeholder until they are re-saved. **Migration**: stop both replicas before running `pnpm -C apps/core run migrate`; bump `@mx-space/api-client` to `5.2.0+`, admin to `8.1.0+`, and any custom frontend to read `thumbhash` instead of `blurHash`. Flush `enrichment:cache:*` in Redis after the migration completes to evict stale enriched payloads. ([339ac4f](https://github.com/mx-space/core/commit/339ac4fd74e6b7ff3ba88bad6780a237f039d20e), [88a0bca](https://github.com/mx-space/core/commit/88a0bcacabd8a7062c87d06813d7bf0d64821edc))

## Highlights

Image placeholders are now generated and rendered with [thumbhash](https://evanw.github.io/thumbhash/). It is smaller on the wire (~24 base64 chars vs ~30), supports transparency, decodes roughly ten times faster on the client, and renders as a plain `<img src="data:image/png;base64,...">` instead of a canvas mount — removing the need for `react-blurhash` everywhere downstream. The server-side encoder uses sharp to pre-resize to ≤100×100 before calling `rgbaToThumbHash`; client-side encoders in admin and frontend mirror the same pre-resize step.

AI translations now run through a writer → reviewer → editor pipeline. The writer produces an initial draft, the reviewer flags issues with structured feedback, and the editor applies fixes in a final pass. The result is noticeably better fidelity on long-form content with no extra cost to operators. See [#2739](https://github.com/mx-space/core/pull/2739) for the full design.

The 0015 schema migration runs as part of the release-phase migrator. It is destructive (`DROP COLUMN blurhash`) and authored under a maintenance-window assumption — operators should follow the deploy plan in the design spec to keep replicas stopped during the SQL run.

## Changes

### Features

- AI translation: writer → reviewer → editor pipeline for higher-fidelity long-form translations ([#2739](https://github.com/mx-space/core/pull/2739))
- Image pipeline: swap blurhash encoder for thumbhash across helper.image, image-meta, and OG capture services ([88a0bca](https://github.com/mx-space/core/commit/88a0bcacabd8a7062c87d06813d7bf0d64821edc))
- Database: rename `enrichment_captures.blurhash` → `thumbhash`; strip dead `blurHash` JSONB keys from content tables and `enrichment_cache.normalized` ([339ac4f](https://github.com/mx-space/core/commit/339ac4fd74e6b7ff3ba88bad6780a237f039d20e))

## Upgrade Notes

1. Enable a maintenance window — public site + admin.
2. Stop both `mx-core` replicas in Dokploy.
3. Run `pnpm -C apps/core run migrate`. The 0015 migration drops `enrichment_captures.blurhash`, strips `blurHash` keys from `posts.images` / `notes.images` / `pages.images` / `drafts.images`, and clears `enrichment_cache.normalized.thumbnailImage.blurhash` + `.captureImage.blurhash`.
4. Flush stale enriched payloads in Redis:
   ```bash
   redis-cli --scan --pattern 'enrichment:cache:*' | xargs -r redis-cli del
   ```
5. Deploy the new `mx-core` image.
6. Deploy admin-vue3 `v8.1.0` (already pinned via `dashboard.version` in this release).
7. Deploy any custom frontend that previously read `blurHash` / `blurhash` — it must read `thumbhash` and ideally render via a thumbhash decoder (e.g. `thumbHashToDataURL`).
8. Disable maintenance page and verify a sample post + link card renders a thumbhash placeholder on freshly-saved content, with accent fallback on legacy content.

Full design and rollout plan: [docs/superpowers/specs/2026-05-28-thumbhash-migration-design.md](https://github.com/mx-space/core/blob/master/docs/superpowers/specs/2026-05-28-thumbhash-migration-design.md).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.1.2...v13.2.0
