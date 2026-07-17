## TL;DR

Companion clients can now publish verified QQ Music and NetEase song links for direct playback from Live Desk.

## Highlights

Yohaku Companion can attach a validated provider song URL to the current media presence. Core advertises the capability during negotiation, accepts legacy clients without the field, validates exact QQ Music and NetEase URL shapes, and preserves the link in public Live Desk projections for compatible web and API consumers.

## Changes

### Features

- Added capability-gated media playback links to Companion Protocol v2 and exposed validated links through public Presence projections. ([7f09010](https://github.com/mx-space/core/commit/7f0901006a88126603993baddfbdf109bcda7722))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.14.0...v13.14.1
