## TL;DR

Paid memberships now support secure premium articles, provider checkout, entitlement-aware delivery, and complete administration from the reader and post interfaces.

## Highlights

Core now provides an end-to-end paid membership system with Dodo Payments checkout, verified and replay-safe webhooks, monthly and yearly plans, effective entitlement tracking, and manual membership grants. Administrators can configure the provider, designate premium Lexical posts, choose the free preview length, inspect reader membership status, and grant, extend, filter, or revoke manual access.

Premium content is projected through a consistent public-access boundary. Post details, lists, feeds, aggregate and activity endpoints, rendered Markdown, search documents, translations, AI insights, WebSocket broadcasts, and shared caches now expose only the configured teaser to unauthorised readers. Provider credentials and product availability are validated before a paywall is advertised, preventing content from being locked behind an unusable checkout.

## Changes

### Features

- Added paid article memberships with Dodo Payments checkout, plan pricing, secure webhook processing, entitlement-aware responses, and typed API-client support. ([#2769](https://github.com/mx-space/core/pull/2769))
- Added premium-post controls and membership management to the administration interface, including reader status filters and manual grants. ([#2769](https://github.com/mx-space/core/pull/2769))

### Bug Fixes

- Improved Chinese-to-Japanese chunk translation guidance to avoid literal, overly formal phrasing in casual content. ([ef8d085](https://github.com/mx-space/core/commit/ef8d08503963a166487e93cb20bf3925238ac88c))
- Stabilised AI-assisted translation editing across repeated updates. ([1793aa3](https://github.com/mx-space/core/commit/1793aa3200f39321e5f707b274ca4e4d8829ce2a))

## Upgrade Notes

- Apply the bundled database migrations before starting v13.15.0. The standard Docker Compose and Dokploy release phase performs this step automatically.
- Paid memberships remain disabled until an administrator selects Dodo Payments, supplies the API and webhook signing keys, configures at least one product ID, registers the `/membership/webhook/dodo` endpoint with Dodo, and enables the membership setting.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.14.1...v13.15.0
