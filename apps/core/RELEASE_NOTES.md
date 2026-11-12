## TL;DR

This patch restores password sign-in for affected accounts after Better Auth upgrades and automatically repairs legacy credential identifiers during deployment.

## Changes

- New owner and review-demo password accounts now receive the credential identifier Better Auth expects, so correct passwords work for both username and email sign-in. ([9c2ad71](https://github.com/mx-space/core/commit/9c2ad7148))
- The normal release migration repairs missing, empty, or outdated password-account identifiers without resetting passwords or changing OAuth accounts, sessions, or Passkeys. It can safely run again; ambiguous duplicate password accounts stop the migration for operator review. ([9c2ad71](https://github.com/mx-space/core/commit/9c2ad7148))

**Full Changelog**: https://github.com/mx-space/core/compare/v17.0.4...v17.0.5
