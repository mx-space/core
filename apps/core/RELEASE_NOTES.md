## TL;DR

Publishing now waits for chosen AI outputs before going live, entitled readers get AI insights, and thought notifications read like homepage musings.

## Highlights

When you select AI resources for a post — summary, insights, translation, or TTS — it now stays in drafts while each task finishes and then publishes complete, with skip flags preventing duplicate generation. The admin editor runs this as a cancellable background process behind a publish dock, so you can keep editing, watch per-task progress, and abort mid-run if something looks wrong.

AI insights on public pages no longer hit a hard premium wall: the same entitlement check that gates TTS now admits the site owner and active members, serving the cached insights instead of a block. Push notifications for new thoughts take the same shape as homepage musings, with the recently event projected into enriched or plain copy and title, subtitle, and body localized on-device through APNs loc-keys.

Two reliability fixes round this out: Apple in-app purchases are verified against the sandbox environment so reviewer and test transactions can't mint production memberships, and Vertex TTS responses that return HTTP 200 with no audio are now retried instead of shipping silent tracks.

## Changes

### Features

- Public AI insights now load for the site owner and active members instead of a hard premium block ([a448c57](https://github.com/mx-space/core/commit/a448c576afe76bebab1a3ee91e6f146b4e8f4ff2))
- Thought push notifications mirror homepage musings, with title, subtitle, and body localized on-device via APNs loc-keys ([9bcf6f7](https://github.com/mx-space/core/commit/9bcf6f71d3f37c6f8af91586831754c14de6295a))
- Posts and notes stay in drafts while selected summary, insights, translation, and TTS generation finish, then publish once without duplicate generation; the admin editor gains a cancellable publish dock ([e229342](https://github.com/mx-space/core/commit/e229342d4a3edcc6589d9ae91f24d6fc32951804), [5f50b9d](https://github.com/mx-space/core/commit/5f50b9d85ce0862234fcfb9971d04cbd7dd6927c))

### Bug Fixes

- Apple purchases are validated against the sandbox environment, keeping test transactions out of production membership ([6df3a88](https://github.com/mx-space/core/commit/6df3a88aaf15d97c4533064b32126c652028932f))
- Vertex TTS responses that return HTTP 200 with no audio are retried instead of producing empty tracks ([41fc406](https://github.com/mx-space/core/commit/41fc4060599ba7b9e6c8ecfa8412999f2a5c211b))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.4.1...v14.5.0
