## TL;DR

Readers can confirm Apple In-App Purchase memberships, and orphan file listing no longer flags live TTS audio.

## Highlights

Membership now accepts Apple In-App Purchases from signed-in readers. The server verifies App Store JWS transactions, maps monthly and yearly product IDs onto the membership row, and applies App Store Server Notifications in order so renewals, cancellations, and entitlement changes stay consistent. `/membership/plans` reports `appleIap` so clients know when StoreKit checkout is available. Owners configure bundle ID, key material, and product IDs in membership settings; Apple IAP can run without replacing the existing Dodo checkout path.

The orphan file list no longer treats live TTS narration as abandoned. Usage checks skip stale TTS reconciliation rows and match generated audio by exact URL instead of a cross-table regex, so newly rendered speech stays off the orphan page immediately. TTS object keys now include the voice configuration, so re-voicing a block writes a new object instead of overwriting a year-long CDN cache under the previous key.

## Changes

### Features

- Confirm Apple In-App Purchases onto a reader's membership, including App Store notifications and admin IAP settings ([#2813](https://github.com/mx-space/core/pull/2813))

### Bug Fixes

- Keep live TTS audio out of the orphan file list, and address re-voiced speech by voice config so CDN-cached objects are not overwritten ([ddf130f](https://github.com/mx-space/core/commit/ddf130f58a29a39834b565044104bdf8e2862a44))
- Align settings detail content with the header padding ([c1f7e62](https://github.com/mx-space/core/commit/c1f7e626c))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.2.0...v14.3.0
