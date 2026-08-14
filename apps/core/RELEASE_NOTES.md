## TL;DR

Long articles now use coordinated, bounded translation sub-agents while ordinary posts retain the existing low-latency translation path.

## Highlights

Translation now measures the actual translatable payload before choosing an execution strategy. Ordinary articles continue through the existing single-Agent workflow, while documents that exceed the safe source or segment budget are divided along stable translation-unit boundaries and delegated through a compact coordinator manifest.

Each long-document chunk runs in an isolated structured-output sub-agent with bounded concurrency, targeted retries, compact neighboring context, and segment-ID merging. Review windows follow the same chunk boundaries, preventing full source and translated documents from accumulating in the coordinator conversation while preserving cancellation, usage accounting, and review behavior.

## Changes

### Features

- Long-document translations can now complete through coordinated chunk delegation without changing the normal path for ordinary articles. ([76b0d2e](https://github.com/mx-space/core/commit/76b0d2e02c40ae5c5f75073c3c02c78e4814adcf))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.29.2...v13.30.0
