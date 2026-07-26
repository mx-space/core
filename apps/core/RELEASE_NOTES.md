## TL;DR

AI cover image generation lands end-to-end: configure a provider, draft a prompt, and pick a cover from the editor drawer.

## Highlights

Authors can generate article covers from the write page without leaving the editor. Enable image generation in AI settings, choose OpenRouter or a custom endpoint, pick a model from the live catalog, then open the cover drawer to draft a style-aware prompt and enqueue generation through the existing task queue. Generated images upload to the same storage path as manual file uploads and can be selected into `meta.cover`.

The image pipeline also powers an agent tool for inline article images, so the write-page AI assistant can generate and insert images when the feature is enabled. Preset mode is the default UX: pick a cover style, let the server compile the prompt, or expand to edit the prompt by hand before generating.

API and AI config polish ship alongside: non-create POST action endpoints now return 200 instead of Nest’s default 201, and OpenAI-compatible text providers can resolve their model list from `{endpoint}/models` when no explicit model list URL is set.

## Changes

### Features

- AI cover image generation: config surface, OpenRouter Images API runtime, task queue, admin cover drawer, and agent `generate_image` tool ([#2775](https://github.com/mx-space/core/pull/2775))

### Bug Fixes

- Resolve live AI model lists from the configured endpoint when `modelListUrl` is omitted, and bump `@earendil-works/pi-ai` to 0.82.0 for Gemini 3.6 Flash registry support ([a28bdf5](https://github.com/mx-space/core/commit/a28bdf5685e6cc3e5a0abf5d9f0aa879ebff4c9d))
- Return HTTP 200 for non-create POST action endpoints (AI list/test, task cancel/retry, membership checkout/webhook, search rebuild, etc.) instead of Nest’s default 201 Created ([49a2572](https://github.com/mx-space/core/commit/49a257221b7c299b5201f56e7cd56efa6072498f))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.16.3...v13.17.0
