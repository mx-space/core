## TL;DR

Validation errors now identify the failing field, and `images: null` payloads are accepted on Post/Note/Page write.

## Changes

### Bug Fixes
- Validation errors from the Zod pipe now return `VALIDATION_FAILED` (422) with `details.errors[]` carrying the offending `field`, `path`, `code`, and `message` — replacing the previous opaque `HTTP_ERROR` envelope. ([ae0ab41](https://github.com/mx-space/core/commit/ae0ab41d558158ad3a3d3f1fe613ed5b72d6e861))
- `images: null` on Post / Note / Page create/update is coerced to `[]` instead of failing validation, matching how the admin and clients sometimes serialize an empty image set. ([ae0ab41](https://github.com/mx-space/core/commit/ae0ab41d558158ad3a3d3f1fe613ed5b72d6e861))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.0.2...v13.0.3
