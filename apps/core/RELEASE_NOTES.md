## TL;DR

Maintenance re-cut that correctly versions the bundled admin dashboard as 8.3.4; the server itself is unchanged from v13.10.0.

## Changes

- The admin dashboard changes shipped in v13.10.0 (analyze page redesign, video upload in the rich editor, agent chat fixes) went out still labeled 8.3.3, so the published `admin-8.3.3.zip` artifact no longer matched its original contents. This release bumps the dashboard to 8.3.4 and republishes it under the correct version.
- The release flow now bumps the in-repo admin version automatically whenever `apps/admin` changed since the previous release, so dashboard artifacts can no longer be overwritten in place. ([3928e87](https://github.com/mx-space/core/commit/3928e8769))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.10.0...v13.10.1
