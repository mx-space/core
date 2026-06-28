## TL;DR

Fixes Twelve Data stock quotes failing with auth errors on existing deploys, and resolves a `ReferenceError` in the `geocode_search` / `geocode_location` serverless built-ins.

## Changes

### Bug Fixes

- **stock**: Trim the decrypted Twelve Data `apiKey` and route quote/bars calls through `axios { params }` so URL-encoding is uniform — accidental whitespace or reserved characters no longer truncate the apikey parameter ([888af60](https://github.com/mx-space/core/commit/888af6029759ea353cf1887983dbed742b20567b)).
- **stock**: `pourBuiltInFunctions` now refreshes the raw source and clears compiled code when the DB-stored built-in differs from the bundled version. Existing deploys previously kept the original buggy snippet forever; the fix now lands on upgrade instead of only on fresh installs ([888af60](https://github.com/mx-space/core/commit/888af6029759ea353cf1887983dbed742b20567b)).
- **serverless**: Read the provider secret from `ctx.secret` in `geocode_search` / `geocode_location` instead of a bare `secret` reference. With the old form, falling through from an empty `adminExtra.gaodemapKey` raised `ReferenceError` instead of reaching the fallback ([bbed967](https://github.com/mx-space/core/commit/bbed967b4eb0110ea5f612dc1eadc2479ac14704)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.5...v13.11.6
