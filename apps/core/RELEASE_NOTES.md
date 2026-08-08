## TL;DR

Fixes Gemini text-to-speech language steering and refreshes core dependencies across five major version upgrades.

## Changes

### Bug Fixes
- Gemini TTS now respects the requested output language instead of defaulting to the model's detection ([3c6b476](https://github.com/mx-space/core/commit/3c6b476861fa44bfa8c8ef1c8b4174ce2f21fdbc))

### Other
- Dependency refresh spanning 102 specs, including five major bumps: ioredis 6 (RESP3 by default, with legacy reply mapping preserved), maplibre-gl 6 (ESM-only, dedicated worker URL), motion 13, @antfu/install-pkg 2, and dotenv-expand 1000 ([#2785](https://github.com/mx-space/core/pull/2785)). All upgrades verified via typecheck, admin build, and a Redis pub/sub cross-pod test under RESP3.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.25.0...v13.25.1
