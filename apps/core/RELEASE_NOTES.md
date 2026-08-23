## TL;DR

Publishing now guides administrators through draft conflicts, while content visibility changes emit the correct visitor-facing lifecycle events.

## Changes

- Publishing remains available when a linked draft conflicts and opens a dialog explaining how to keep the current content or use the server version ([55340d5](https://github.com/mx-space/core/commit/55340d504ad6024a6d427371c28dd9757d18b77a)).
- Posts and notes now emit the correct create or delete event when publication visibility changes, while draft-only updates stay private ([a9e0047](https://github.com/mx-space/core/commit/a9e0047a4d46391f01e8d2a5072441b42ab71b9e)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.3.0...v14.3.1
