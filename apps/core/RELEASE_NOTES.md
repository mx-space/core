## TL;DR

Progressive Markdown→Lexical migration for posts, notes, and pages, plus Dependabot security dependency patches.

## Highlights

Admin no longer blocks format switching as soon as a Markdown document has content. Eligible Markdown posts, notes, and pages can convert to Lexical per document: conversion is gated on supported syntax, opens diagnostics when unsupported constructs remain, and only becomes published when you save—so drafts can stage Lexical without forcing a live switch.

The server dry-runs conversion (including coupled AI translations), then commits Markdown→Lexical atomically on save for the source document and its translations. Historical Markdown draft snapshots stay as an immutable audit trail; Lexical still owns `content` with a writer-owned Markdown `text` projection.

## Changes

### Features
- Progressive Markdown-to-Lexical migration for posts, notes, and pages, with dry-run eligibility, source-located diagnostics, and atomic save-time commit (including AI translations) ([#2777](https://github.com/mx-space/core/pull/2777))

### Other
- Patched Dependabot-reported direct and transitive dependency vulnerabilities (`@fastify/static`, `js-yaml`, `react-router`, `fast-xml-parser`, and related overrides) ([eb78fe2](https://github.com/mx-space/core/commit/eb78fe28f))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.19.0...v13.20.0
