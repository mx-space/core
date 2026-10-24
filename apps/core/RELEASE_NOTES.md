## TL;DR

This release adds Steps-aware AI and reusable Admin components, improves editing reliability, and strengthens privacy, subscription confirmation, and resource safeguards.

## Highlights

Steps blocks now participate in AI translation, document context, and search text, including their titles and nested content. The bundled Admin adds a catalog for managing, previewing, and inserting reusable dynamic components, and the write agent can register components for later use. Nested editor updates also reach the parent document reliably without marking unchanged content as edited.

Public responses now protect comment contact information and restricted notes more consistently. Email subscription requests require the recipient to confirm before preferences change. Outbound requests, browser access, backup extraction, uploads, and sandbox execution have tighter access and resource boundaries, reducing the impact of untrusted URLs, oversized responses, and competing work.

## Changes

### Features

- Translate Steps titles and nested step content, and include Steps in AI document context and search text. ([b5f7db3](https://github.com/mx-space/core/commit/b5f7db3093a16d17071119e2ea49ea8efd1529c7), [c06c1a5](https://github.com/mx-space/core/commit/c06c1a5b46c316531b490defab21a075096fd957))
- Manage, preview, edit, and insert reusable dynamic components from the bundled Admin catalog. ([5821f42](https://github.com/mx-space/core/commit/5821f427844419e676549a7ce82dee7a785b099a))
- Let the Admin write agent register reusable components in the catalog. ([a86f9d4](https://github.com/mx-space/core/commit/a86f9d4fb9b1c8e7b54352ff984dc64eaba21202))

### Bug Fixes

- Protect comment contact details, restricted notes, push activation, and authenticated WebSocket access. ([#2858](https://github.com/mx-space/core/pull/2858))
- Require email confirmation before applying subscription preferences, and generate confirmation and unsubscribe links with the API route prefix. ([#2858](https://github.com/mx-space/core/pull/2858))
- Bound outbound responses, browser network access, backup extraction, upload concurrency, and sandbox capacity. ([#2858](https://github.com/mx-space/core/pull/2858))
- Preserve spaces beside inline strikethrough tags, propagate nested editor changes immediately, and avoid false edits when opening nested lists. ([fe194e2](https://github.com/mx-space/core/commit/fe194e2a22ea7040614d96e3dd9d48cca8728ad5), [4fedcbe](https://github.com/mx-space/core/commit/4fedcbed257b1247d4e2952d8afc00e1c3d69f33), [c6cb493](https://github.com/mx-space/core/commit/c6cb493725e594d263effec10aeb177895a9773e))
- Keep text readable in Admin modals, drawers, and bottom sheets by inheriting the surface foreground color. ([038657b](https://github.com/mx-space/core/commit/038657b8c995cff0cd769ef7ed16dd209a4aea2f))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.1.0...v15.2.0
