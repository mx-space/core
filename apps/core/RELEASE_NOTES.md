## TL;DR

AI generation now records per-request metrics — tokens, cost, and latency — across insights, summary, translation, and narration, and the admin gains richer provider configuration.

## Highlights

Every AI operation — insights, summary, translation, and TTS narration — now logs a generation record capturing the model, token counts, estimated cost, and latency into a new persistent ledger (migration 0029, applied automatically). The admin surfaces these metrics in each task's detail drawer with localized labels, so operators can finally see what each AI pass actually cost and how long it took, per article and per task type.

Provider configuration in the admin is more robust: built-in provider presets speed up onboarding, the model-assignment and TTS-voice fields validate against the live catalog, and per-model pricing feeds cost estimates back into the metrics ledger. A new TTS language strategy picks the right voice and script per language automatically. The test suite gains a database-safety helper so it can no longer mutate shared state.

## Changes

### Features
- AI generation metrics ledger records tokens, cost, and latency across insights, summary, translation, and TTS ([e47f4b7](https://github.com/mx-space/core/commit/e47f4b7d2bc25c96cee3badb45f6c53782b19fe5))
- Smarter AI provider settings: presets, live-validated model/voice assignment, per-model pricing, and a TTS language strategy ([24530fe](https://github.com/mx-space/core/commit/24530fe47e17bc4e209ef27891cbb32ecf8c3309))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.24.0...v13.25.0
