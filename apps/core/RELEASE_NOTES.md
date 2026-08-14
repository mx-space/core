## TL;DR

Vertex AI structured text tasks now use native function calling, eliminating failures caused by incompatible OpenAI-compatible tool selection.

## Changes

- Vertex text generation now uses Google's native `generateContent` stream instead of the OpenAI compatibility facade.
- Structured writer and translation responses require a native function call, preventing the previous HTTP 400 failure. ([556bf64](https://github.com/mx-space/core/commit/556bf64242bcab7da6f26a0e090c32292440591b))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.29.1...v13.29.2
