## TL;DR

Yohaku push notifications now carry who published, cover images, note weather and mood, and the actual text of comment replies.

## Highlights

Content notifications sent through Push Relay now include the site owner's name, an HTTPS cover image, and, for notes, the recorded weather and mood. Updated Yohaku apps use these to show who published the post or note, attach the cover as a thumbnail, and place the note's atmosphere under its title. The visible alert sent to devices is unchanged, so older app builds keep today's banners.

Reply notifications can now include a short, cleaned excerpt of the reply itself. Markdown is stripped, images and code blocks become placeholders the app localizes, and the excerpt is capped so it always fits Relay's limits. Push Relay erases the excerpt from its event log as soon as every delivery for that reply has finished.

## Changes

### Features

- Send owner name, cover image, note weather and mood, and a cleaned reply excerpt with Yohaku push notifications. ([dad8dd7](https://github.com/mx-space/core/commit/dad8dd7f3aba92eb9c40e712c2794a2c71867026))

### Other

- Admin editor picks up the streaming agent-write reveal and refined Details disclosure styling from the latest Haklex packages. ([0ffc00f](https://github.com/mx-space/core/commit/0ffc00f51), [03f38a1](https://github.com/mx-space/core/commit/03f38a175))

## Upgrade Notes

- Deploy Push Relay before this Core release. A Relay older than this release rejects the new optional fields, and affected notifications are retried until Relay is updated.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v16.2.0...v16.3.0
