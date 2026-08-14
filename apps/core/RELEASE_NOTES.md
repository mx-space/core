## TL;DR

This patch accepts Redis TLS URLs from managed providers and keeps AI sessions pinned to one provider.

## Changes

- Redis now accepts `REDIS_URL` (and `rediss://` URIs from providers such as Upstash) without extra mapping. ([#2805](https://github.com/mx-space/core/pull/2805))
- AI chat, image, and TTS stay on the same provider session for one operation, so follow-up calls no longer drift. ([93e1bd0](https://github.com/mx-space/core/commit/93e1bd0f9ca6776a9aad9757a0ef5a0cf69c288a))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.29.0...v13.29.1
