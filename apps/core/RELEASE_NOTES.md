## TL;DR

Hotfix reverting the v12.9.2 dynamic baseURL change, which caused auth requests from non-allowlisted hosts to fail with an internal error.

## Changes

- Reverted the v12.9.2 dynamic device-verification change. It made Better Auth throw an internal error on any `/api/v2/auth/*` request whose `Host` header was not in the configured allowed origins, breaking authentication for affected clients. Upgrading from v12.9.2 restores stable auth behaviour. ([12828bf](https://github.com/mx-space/core/commit/12828bf4cf97661e3adc628b9524bc082f5b0d1e))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.9.2...v12.9.3
