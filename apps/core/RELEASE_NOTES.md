## TL;DR

Premium articles now open free for a limited window after publishing, then move into the Sponsor Archive where readers can unlock a single article or sponsor.

## Highlights

**Free window, then Sponsor Archive.** A premium article is fully public for a configurable period after publishing (immediately, 24h, 48h, 72h, 7 days or custom). When the window ends the article enters the Sponsor Archive: readers without access see the configured preview blocks and a paywall. Entitlement is resolved in one place on the server (`public` / `owner` / `free-window` / `purchase` / `membership` / `locked`) and exposed in `meta.paywall.entitlement`, so front-ends never guess.

**One-time article purchase.** Readers can permanently unlock a single article through Dodo Payments in addition to the monthly / yearly sponsorship. The price comes from the configured one-time product, purchases are recorded per reader and article, refunds and disputes revoke access, and webhooks are verified against the exact product line and amount before a purchase is honoured.

**Author tooling.** The editor gains a Premium Article panel with a live status line (waiting for publish / free window remaining / archived), free-window presets and extend / end-now controls for published posts, a paywall-position slider that previews the surrounding blocks while dragging, and a per-article toggle for single purchase. Membership settings gain a Single Article Purchase section with a read-only price check.

## Changes

### Features
- Free window after publishing with server-written `freeUntil`, free-window readers get full content, and WebSocket updates are truncated for archived premium posts ([5eb5810](https://github.com/mx-space/core/commit/5eb5810266a56ad353c57963db618f200471156f))
- `meta.paywall` now carries `freeUntil`, `entitlement.reason` and `purchase.{enabled, price}` on every premium post ([3512a66](https://github.com/mx-space/core/commit/3512a66bc9076e2badce310cb22d70fc4c22eacc))
- Single-article checkout (`POST /membership/article-checkout`), purchase lookup and Dodo webhook handling for one-time payments, refunds and disputes ([ec0261c](https://github.com/mx-space/core/commit/ec0261c96b5b1765313516387e518e1ec74f76bc), [774c13a](https://github.com/mx-space/core/commit/774c13a6c943c86a5f8fe1ebb7dcbb6e58972de6))
- AI summaries of archived premium posts stay visible as a teaser; generation is still reserved for entitled readers ([034e35d](https://github.com/mx-space/core/commit/034e35d397f2087ab02e20e1aa0d5f5d522aadb4))
- Admin: Premium Article panel, free-window controls, paywall-position context popover and Single Article Purchase settings ([5a296c7](https://github.com/mx-space/core/commit/5a296c775), [094a1bf](https://github.com/mx-space/core/commit/094a1bffe), [7016045](https://github.com/mx-space/core/commit/701604588))

### Bug Fixes
- One-time products no longer report a missing price ([4334475](https://github.com/mx-space/core/commit/4334475198774b8e7c93c8399408009def5474a5))
- Article webhooks are rejected unless they match the configured product with a positive amount; malformed ids and cart lines are ignored instead of failing ([32339df](https://github.com/mx-space/core/commit/32339dfa2e1581adf77d7ebf167a18e63775b8da), [2441314](https://github.com/mx-space/core/commit/2441314573aabd90e051735e81272c258d66d593), [9a775a7](https://github.com/mx-space/core/commit/9a775a71ec9d14df9120b1db99943b70fbb8a446))
- Link-card enrichment no longer exposes text or summaries of unpublished, password-protected or archived premium posts ([32339df](https://github.com/mx-space/core/commit/32339dfa2e1581adf77d7ebf167a18e63775b8da))
- Invalid `meta.paywall` values are rejected on save instead of silently defaulting ([32339df](https://github.com/mx-space/core/commit/32339dfa2e1581adf77d7ebf167a18e63775b8da))
- Post lists apply saved summary translations ([#2823](https://github.com/mx-space/core/pull/2823))
- Zero-decimal currencies display correctly in the article price check ([e78b14e](https://github.com/mx-space/core/commit/e78b14efca000a4af2f1e95237d8602a5ffc228f))

## Upgrade Notes

- Schema migration `0039_article_purchases` adds the `article_purchases` table (expand-only); run the release-phase migrate step before starting the new server.
- To enable single-article purchases: create a one-time product in Dodo, subscribe the existing webhook endpoint to `payment.succeeded`, `refund.succeeded`, `dispute.accepted` and `dispute.lost`, then set **Single Article Purchase** and the **Article Product ID** under Settings → Membership.
- Front-ends should upgrade to `@mx-space/api-client@5.10.0` for the new `PaywallMeta` and membership methods.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.11.0...v14.12.0
