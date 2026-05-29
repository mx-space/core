## TL;DR

Patch release: the admin dashboard bundled with the server now reliably supersedes any previously downloaded copy after an upgrade.

## Changes

- **admin**: the dashboard version baseline was raised to `8.2.0`, above the last `mx-space/mx-admin` GitHub release (`8.1.0`). The server picks the higher-versioned of the bundled dashboard and any copy previously downloaded into the data directory; with the in-repo dashboard having restarted at `7.0.x`, a stale `8.1.0` copy was being served instead of the freshly bundled build. The dashboard shipped with this server is now served without manually clearing the data directory. ([69e7657](https://github.com/mx-space/core/commit/69e76578))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.3.0...v13.3.1
