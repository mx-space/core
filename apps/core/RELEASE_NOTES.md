## TL;DR

Snippets become a virtual filesystem and skills become multi-file bundles, with the post-detail wire updated to deliver the bundle manifest under `meta.skills`.

## Breaking Changes

- **snippet:** the snippet schema drops `name`, `reference`, and `custom_path` columns in favour of a single POSIX-style `path`. **Migration**: schema migration `0022_snippet_vfs` runs automatically on boot; any external HTTP client that constructed snippet requests around `{name, reference, customPath}` must be updated to the path-keyed `PUT /snippets/by-path` surface (admin UI and `mxs` CLI already do this since 5.4.0).
- **post detail response:** an attached skill no longer ships under `post.skills`; it now lives on the response envelope at `meta.skills` with an asset manifest under `assets[]`. The legacy `PublicSkillView` type is replaced by `SkillBundleView` (no `raw` field; assets carry `path`, `rawUrl`, `type`, `size`). **Migration**: consumers should update to `@mx-space/api-client@^5.4.0` and read `meta.skills` instead of `data.skills`; an unmigrated frontend simply hides the skill card (no crash).

## Highlights

Skill attachments graduate from a single inline markdown blob into a real bundle. A SKILL.md sits at the root of its folder and can reference siblings — `references/usage.md`, `scripts/run.sh`, nested subdirectories — and the post detail API now returns the full asset manifest with absolute fetch URLs. AI agents pulling a skill no longer need any list-endpoint plumbing: the manifest plus the existing public `/s/<path>` route are enough to retrieve every file in one pass.

Under the hood the snippet subsystem is now a virtual filesystem keyed on a POSIX-style path. The legacy `(name, reference, customPath)` triplet is gone; every snippet is one file row, directories are derived from path prefixes at query time, and the repository gains recursive list, prefix move, prefix delete, and `findAssetsByDirs` for bundle queries. `POST /snippets/import` is now transactional and upserts by path so a multi-file bundle can be pushed atomically.

The response envelope picks up a small refactor that pays for the new behaviour: `MetaObjectBuilder` is now generic over its schema with per-resource subclasses (`PostMetaBuilder`, `NoteMetaBuilder`), and resource-attached metadata always lands on `meta` instead of being mixed back into the entity. This also fixes an existing V2 violation where `skills` were being merged into the post object.

## Changes

### Features

- Skill bundles can ship arbitrary supporting files; post detail responses now carry `meta.skills` with a per-bundle asset manifest ([af4b771](https://github.com/mx-space/core/commit/af4b7717cc26967b8c5261c1187b89e9c62e0144))
- `MetaObjectBuilder` split into a cross-cutting base and per-resource `PostMetaBuilder` / `NoteMetaBuilder`; `note.controller` and the AI insights / summary controllers move attached metadata onto the response meta envelope ([af4b771](https://github.com/mx-space/core/commit/af4b7717cc26967b8c5261c1187b89e9c62e0144))
- Snippet subsystem becomes a path-keyed virtual filesystem with recursive list / move / delete, prefix-aware asset queries, and a transactional `POST /snippets/import` ([54326e2](https://github.com/mx-space/core/commit/54326e25d9ebdbbd098ec562de0d07518b351c2a))
- New end-to-end harness drives the `mxs` CLI against an in-process NestFastify backend with isolated PostgreSQL and Redis per test file; 22 specs / 86 tests cover auth, content CRUD, AI management, file upload, skill rendering, help, and output-mode contracts ([#2755](https://github.com/mx-space/core/pull/2755))

## Upgrade Notes

- Run schema migrations as part of the rolling deploy: `pnpm -C apps/core run migrate` (or rely on the `mx-migrate` compose service). Migration `0022_snippet_vfs` is destructive — it drops the old `name`, `reference`, `custom_path` columns; ensure any external integration that addresses snippets by those fields has been updated first.
- Yohaku / Shiro / any custom frontend reading post detail should bump `@mx-space/api-client` to `^5.4.0` and switch from `data.skills` to `meta.skills`. The wire change soft-degrades for unmigrated clients (skill card hidden, no crash).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.10.10...v13.11.0
