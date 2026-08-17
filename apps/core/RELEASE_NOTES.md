## TL;DR

Ships reader content and comment-reply push for Yohaku, with APNs Communication metadata and a presence-avatar trust fix.

## Highlights

Yohaku readers can now receive alerts when published posts, notes, or recently entries go live, and when someone replies to their comments. Core enriches those events with public titles, summaries, and tap paths, skips content that has no summary, and keeps private or unpublished work out of the payload. Comment replies carry sender metadata so iOS can render Communication Notifications.

Device activation is a single public `POST /notifications/push/activate`. Relay owns per-device preferences; Core stores source metadata with an optional reader. Bindings are scoped to the owning installation, so a device can read, update, or revoke its own record without a session cookie.

Presence avatars no longer trust a client-supplied reader id. The gateway accepts an optional HTTPS image, resolves identity from session or socket, and returns only the public reader card.

## Changes

### Features

- Fan out published content and comment-reply alerts to Yohaku readers, including localized APNs payloads and mutable-content on replies ([#2812](https://github.com/mx-space/core/pull/2812))
- Public push activation and installation-scoped Relay binding APIs, with optional reader association instead of reader-owned endpoints ([#2812](https://github.com/mx-space/core/pull/2812))

### Bug Fixes

- Keep presence avatars without trusting a client-supplied `readerId` ([9e0e9ab](https://github.com/mx-space/core/commit/9e0e9aba2fa72a5147c53fd4b937b4a674ce9ccf))
- Block private content metadata from push payloads and reject encoded path traversal in notification targets ([#2812](https://github.com/mx-space/core/pull/2812))

## Upgrade Notes

Release-phase will apply migration `0033`, which makes `push_relay_bindings.owner_id` nullable and drops any leftover `push_reader_preferences` table. No extra operator SQL is required.

Comment-reply Communication Notifications also need a Push Relay that understands the enriched payload. Redeploy Relay alongside this Core tag before shipping the Yohaku client.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.1.0...v14.2.0
