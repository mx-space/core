## TL;DR

This release hardens Open Graph enrichment: link cards now skip anti-bot challenge pages and stop rendering favicons in place of real preview images.

## Highlights

Open Graph browser mode now resists anti-bot defenses. Every agent-browser fetch carries a realistic user agent and language headers, waits for network idle instead of a fixed delay, and inspects the main document's HTTP status. Cloudflare and Akamai challenge pages are detected by signature and retried once; a persistent block surfaces as a distinct error instead of being cached as valid HTML.

The Open Graph parser is now strict about preview images. The `image` field holds only a genuine `og:image` or `twitter:image`, so link cards no longer drop a square favicon into a wide image slot. Image dimensions are parsed from `og:image:width` and `og:image:height`, and any discovered icons move to the result's `links` collection.

## Changes

### Features
- Open Graph browser mode detects and skips Cloudflare/Akamai challenge pages, sends realistic browser headers, and waits for network idle — preventing anti-bot interstitials and HTTP 4xx/5xx error pages from being cached as page content. ([#2724](https://github.com/mx-space/core/pull/2724))
- The Open Graph parser keeps the `image` field strictly to real `og:image`/`twitter:image` values, parses image dimensions from OG width/height tags, and relocates favicons and link icons into `links`. ([8651e5c](https://github.com/mx-space/core/commit/8651e5c24e73c0459625e069d3e0a3c56b8e4153))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.5.4...v12.6.0
