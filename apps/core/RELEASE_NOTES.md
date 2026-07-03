# v13.11.12

## TL;DR

Fixes task-list timeouts and restores AI artifact generation when draft posts are published.

## Changes

- Task listing no longer scans and parses the full Redis task index before returning a page, preventing `/api/v3/tasks` from timing out on large task histories ([8bba4da](https://github.com/mx-space/core/commit/8bba4da1b9ffe092a0ba5ba492fcd06db5a3e7e0)).
- Stale or malformed task payload, result, or log JSON now degrades gracefully instead of taking down the whole task list response ([8bba4da](https://github.com/mx-space/core/commit/8bba4da1b9ffe092a0ba5ba492fcd06db5a3e7e0)).
- AI Summary and AI Insight update hooks now create initial tasks when an unpublished article is later published and has no existing AI artifact yet ([8bba4da](https://github.com/mx-space/core/commit/8bba4da1b9ffe092a0ba5ba492fcd06db5a3e7e0)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.11...v13.11.12
