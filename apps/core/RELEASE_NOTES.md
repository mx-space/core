## TL;DR

Reliability fixes: exception responses with a non-numeric status code no longer crash, and the mxs device-login link is restored on the request's own host.

## Changes

- Exception handling no longer crashes when an error carries a non-numeric status. A Better Auth `APIError` exposes a string status (e.g. `INTERNAL_SERVER_ERROR`); the exception filter now normalizes any status to a valid numeric HTTP code, so the response is sent instead of failing with an unhandled rejection. ([f24c9f9](https://github.com/mx-space/core/commit/f24c9f9c2c6c8f22d74f1e6b22cede3a8eb887ca))
- `mxs auth login` again shows the device verification link on the same host the CLI connected to. This re-applies the change reverted in v12.9.3, now with a mandatory fallback (the configured server URL), so auth requests from hosts outside the allow-list resolve cleanly instead of breaking authentication. ([d591655](https://github.com/mx-space/core/commit/d5916554e5eb2cbc64c563dd37bb951964312355))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.9.3...v12.9.4
