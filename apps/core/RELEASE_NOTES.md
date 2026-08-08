## TL;DR

AI provider configuration now unifies text, image, and speech capabilities while adding automatic text-to-speech voice discovery in Admin.

## Highlights

AI providers can now declare text, image, and speech capabilities through one shared configuration. Image generation and text-to-speech assignments use the same provider model as writing, summaries, reviews, translation, and insights, reducing duplicated credentials and preventing providers from being removed while they remain assigned.

The Admin interface now exposes image-generation defaults and complete text-to-speech controls in the unified AI settings. Supported OpenAI speech models provide a built-in voice catalog, while compatible providers can supply a remote catalog; manual voice entry remains available when discovery is unavailable.

## Changes

### Features

- Configure text, image, and speech workloads through capability-aware AI providers. ([cbb73df](https://github.com/mx-space/core/commit/cbb73dfe4142adbce24468cc65eb9c59c9fb4820))
- Discover built-in or provider-hosted text-to-speech voices directly from Admin. ([cbb73df](https://github.com/mx-space/core/commit/cbb73dfe4142adbce24468cc65eb9c59c9fb4820))
- Automatically normalize existing image-generation and text-to-speech settings into the unified configuration. ([cbb73df](https://github.com/mx-space/core/commit/cbb73dfe4142adbce24468cc65eb9c59c9fb4820))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.23.0...v13.24.0
