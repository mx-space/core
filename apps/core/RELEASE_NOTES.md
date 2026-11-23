## TL;DR

Fixes the blank admin dashboard from v18.2.1–v18.2.2, which failed to load with "Uncaught SyntaxError: missing ) after argument list".

## Changes

- The bundled admin dashboard (`/proxy/qaqdmin`) loads again. A workspace-wide bundler pin built the admin with a rolldown version Vite does not support, which left invalid code at every lazy-loaded route and stopped the whole app from loading. Vite now uses its own supported rolldown version. ([adc1a95](https://github.com/mx-space/core/commit/adc1a954e74ee042a0bcf80a74150dbe3f3fa90f))
- Security updates for build and test dependencies (happy-dom 21.0.4, fast-uri 4.2.3). ([c3e9aab](https://github.com/mx-space/core/commit/c3e9aab6c), [5af2b72](https://github.com/mx-space/core/commit/5af2b72aa))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.2.2...v18.2.3
