## TL;DR

Google Vertex AI is now available as a first-class AI provider across text, image, and TTS.

## Highlights

This release adds Google Cloud's Vertex AI as a unified provider option in the admin AI settings, complementing the existing OpenAI-compatible providers. Operators can now route text generation, image generation, and text-to-speech through Vertex's Gemini model family from a single configured provider, without standing up a separate OpenAI-compatible proxy.

Behind the scenes, text providers were reorganized behind the same shared protocol registry that image and TTS already use. Aligning all three modalities on one extensibility model lets new backends be added consistently and keeps existing adapters maintainable.

## Changes

### Features
- Add Google Vertex provider adapters for AI text, image, and TTS ([#2794](https://github.com/mx-space/core/pull/2794))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.25.3...v13.26.0
