## TL;DR

Live Desk now accepts versioned album artwork URLs, enabling Yohaku Companion to publish cache-safe cover images alongside current media presence.

## Highlights

Companion Presence v2 now negotiates a dedicated media-artwork capability and validates a single HTTPS cover URL with an explicit SHA-256 cache version. Clients can replace one stable object while consumers receive a versioned URL, avoiding unbounded object growth and stale CDN content without adding another deployment setting.

The public presence projection and admin client now carry artwork when available. Artwork remains optional: an unavailable or invalid cover does not prevent sanitized media text, playback state, or timeline updates from reaching Live Desk, preserving the existing fail-soft presence behavior.

## Changes

### Features

- Added negotiated Live Desk album artwork support across Companion validation, public projection, and the admin API contract ([1af22ad](https://github.com/mx-space/core/commit/1af22adac0c6d997cbd916ea13d5ddfe2d35d583)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.13.1...v13.14.0
