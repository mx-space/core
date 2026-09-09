## TL;DR

Share draft revisions through public links, preview and version agent-generated components in the admin, and faster search and aggregate queries.

## Highlights

Drafts can now be shared before publishing. Each document gets one share link that either pins a frozen revision or follows the draft branch head. Repointing the link keeps the same token, so viewers never lose their URL. The admin version tree drives the whole flow, and `api-client` exposes the public read as `draft.getShared`.

The writing agent can now hand back dynamic components. The admin previews them inline, keeps every generated version, and publishes the chosen one as an immutable file upload. The file upload endpoint accepts an `immutable=true` flag for this, which stores the object under a versioned key so published components never change under a link.

Keyword search no longer loads every candidate document and filters it in memory. Matching now runs in PostgreSQL, and aggregate, category, and note lookups issue fewer queries. Startup logs a per-phase timing breakdown so slow boots are easier to diagnose.

## Changes

### Features
- Share a draft revision through a public link, pinned or following the draft head ([f626b42](https://github.com/mx-space/core/commit/f626b4277b0f534034b78b5d8b2ec024154be6a3))
- Preview, version, and publish agent-generated components from the admin; immutable file uploads ([6e9c14a](https://github.com/mx-space/core/commit/6e9c14abe935a2d203fdb3ad788452313308b7d7))

### Bug Fixes
- OpenAPI document once again folds nullable fields into optional ones and keeps heterogeneous unions after the Zod 4.5 upgrade ([4babe26](https://github.com/mx-space/core/commit/4babe268e940043e8fcbf35ec19743bb35359d62))

### Other
- Search runs keyword matching in the database; aggregate and category queries issue fewer round trips; startup phase timings are logged ([29001ec](https://github.com/mx-space/core/commit/29001ec533d3c06b3339318ad875867455593bc5))
- Dependency refresh: Zod 4.5, jose 6.2.12, undici 8.10 ([80a40a7](https://github.com/mx-space/core/commit/80a40a74c))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.9.1...v14.10.0
