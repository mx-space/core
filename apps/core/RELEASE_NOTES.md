## TL;DR

Internal maintenance release; no user-facing changes.

## Changes

- Updated the rich-text engine to `@haklex/*` 0.30.1, picking up upstream fixes for remote extension loading, preview rendering, and Mermaid diagram sizing, and deduplicating the bundled `shiki` highlighter to a single copy ([a340826](https://github.com/mx-space/core/commit/a34082678))
- Refreshed dependencies across all workspaces (vite 8.1.3, rolldown 1.1.4, shiki 4.3.1, sharp 0.35.3, resend 6.17.1, and more); `undici` intentionally stays on v7 for Node fetch compatibility ([187cc34](https://github.com/mx-space/core/commit/187cc3444))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.13...v13.11.14
