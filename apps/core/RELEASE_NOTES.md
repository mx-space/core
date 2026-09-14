## TL;DR

Short-field translations (tags, category names, moods, weather) can now run on their own AI model, separate from article translation.

## Changes

- AI settings gain a "Field translation" model assignment under the Translation section. Leave it empty to keep using the article translation model. ([55fb9a6](https://github.com/mx-space/core/commit/55fb9a604dd6ac2777260bb53e61fd3b7cbdb472))
- Gemini-based providers return empty results for the field translation prompt's map-shaped output; assign a non-Gemini model here if tag translations stay empty after "Regenerate".

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.12.2...v14.12.3
