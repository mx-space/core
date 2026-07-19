## TL;DR

Fixes AI generation failing with a 400 error when an OpenRouter model with mandatory reasoning (e.g. Gemini 3.1 Pro) is configured.

## Changes

- AI requests through OpenRouter no longer ask to disable reasoning; models that require it (such as `google/gemini-3.1-pro-preview` used for translation review) now work instead of failing with `Reasoning is mandatory for this endpoint and cannot be disabled` ([e899ef0](https://github.com/mx-space/core/commit/e899ef0899bbb70298380ed292382460004e5278))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.16.0...v13.16.1
