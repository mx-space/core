## TL;DR

The post list API can exclude fully-AI-written posts, and draft autosave no longer overwrites conflicting edits.

## Highlights

The posts list endpoint accepts a new `excludeAiWritten` query flag. When set, posts whose AI disclosure marks them as fully AI-written (`meta.aiGen` preset `2`, matched in both scalar and array form) are filtered out at the SQL level. This powers the new "No AI writing" toggle on the Yohaku post list, letting readers browse only human-written articles; partially assisted posts (AI titles, illustrations, organizing help) are unaffected.

Draft autosave is now version-aware: an autosave that would clobber a newer save of the same draft is rejected instead of silently overwriting it, so editing the same draft from two places no longer loses work.

## Changes

### Features

- Posts list: `excludeAiWritten` query flag filters out fully-AI-written posts ([d1702ec](https://github.com/mx-space/core/commit/d1702ec18cc816e67afe8dddb2c9cd82f12e9ec1))
- Draft autosave: version-checked updates prevent conflicting overwrites ([#2776](https://github.com/mx-space/core/issues/2776)) ([cd00d35](https://github.com/mx-space/core/commit/cd00d35c49066740d0de3c326c65b5505ae4a813))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.18.0...v13.19.0
