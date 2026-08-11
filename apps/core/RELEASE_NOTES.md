## TL;DR

Dodo subscription webhooks no longer reject valid deliveries, and sign-in from the Yohaku mobile app is now trusted.

## Highlights

Every subscription webhook Dodo sends is now accepted. Previously only six event names were understood, so a correctly signed `subscription.updated` delivery — the event Dodo emits whenever a subscription's state changes — was answered with `400`, and the membership never reached the database. Both `subscription.updated` and `subscription.update_payment_method` are now resolved from the subscription's own `status` field, and `subscription.failed` is handled as a cancellation.

Events the server has no use for stop being treated as failures. Payment, dispute, and payout notifications, along with subscriptions that carry no `readerId` in their checkout metadata, now return `200` with an `ignored` marker and a log line explaining the decision, so the provider stops retrying them indefinitely. A signature that genuinely fails to verify still returns `400`, and the underlying reason — bad key, or a timestamp outside the five-minute window — is now written to the server log.

The Yohaku mobile client can complete an OAuth or passkey round trip against this server. The better-auth expo plugin is registered and the `yohaku://` scheme is trusted as an origin in every environment.

## Changes

### Features

- Mobile sign-in from the Yohaku app via the `yohaku://` scheme ([ff52b84](https://github.com/mx-space/core/commit/ff52b84940107f7622aedfd595759d74608b4ab5))

### Bug Fixes

- Subscription webhooks are accepted for every event Dodo sends, and unusable events are acknowledged instead of retried forever ([9f1b6a4](https://github.com/mx-space/core/commit/9f1b6a4235f677d4e77f437e2f6eba34d5c2b246))

## Upgrade Notes

- Subscription events that failed against an earlier version can be replayed from the Dodo dashboard once this version is live; a replay carries a fresh signature and timestamp, so it verifies normally.
- The webhook endpoint's error codes changed. `WEBHOOK_VERIFY_FAILED` is gone: signature failures now return `WEBHOOK_SIGNATURE_INVALID` (400) and an unknown provider in the URL returns `MEMBERSHIP_PROVIDER_NOT_SUPPORTED` (404). Update anything that matched the old code.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.28.0...v13.29.0
