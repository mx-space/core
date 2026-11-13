## TL;DR

Prepare existing installations for v18 with read-only diagnostics, transactional data preparation, and controlled JWT rotation while retaining v17 compatibility.

## Highlights

This release provides an explicit preparation path for existing installations. The standalone upgrade tool checks configuration, stored credentials and AI metadata without starting HTTP services or background jobs. Preparation supports a full dry-run and commits converted data only when every required check succeeds.

The application retains v17 behavior while preparation is rolled out. Existing maintenance GET routes remain available alongside their new POST equivalents, and legacy configuration inputs remain compatible. AI metadata moves to the metrics ledger while existing response fields and physical database columns remain available.

## Changes

### Features

- Inspect v18 readiness without modifying stored data or exposing secret values. ([d701c19](https://github.com/mx-space/core/commit/d701c195d4861b2ece41d6014e70d0eb2238e4f0))
- Convert legacy configuration and credentials transactionally, with dry-run, safe retries and preservation of existing API-key strings. ([90593d9](https://github.com/mx-space/core/commit/90593d98e25fbab4c396cfea4495e6e1ff79bf30))
- Rotate JWT secrets during a maintenance window while preserving OAuth provider tokens; successful rotation invalidates login sessions. ([2731cef](https://github.com/mx-space/core/commit/2731cef62edf578437071c08848c49ec9a971c66))
- Use POST for bundled Admin backup creation, cache clearing and test mail; existing GET callers continue to work. ([0576bc5](https://github.com/mx-space/core/commit/0576bc555ae6e4f8292b82fc66ac21d4e4b2acac))

### Bug Fixes

- Reject conflicting credentials and unreadable encrypted data without committing a partial preparation. ([115f741](https://github.com/mx-space/core/commit/115f741171fd6f671db6857bf3991f96743e4968))
- Recognize a new installation only when its application data is truly empty. ([3d083cd](https://github.com/mx-space/core/commit/3d083cdcb95efdb7d55354d9c95cc1eff4d7cf8a))

### Other

- Update the bundled rich editor, including full-width table cell content. ([48ac0bc](https://github.com/mx-space/core/commit/48ac0bcc9800b133428109af8ac1205349331ebb))

## Upgrade Notes

- Pin both application and migration images to `innei/mx-server:17.1.0`. Deploy this compatible reader to every replica before enabling V2 writes or running preparation.
- Save database/files snapshots and the original field key, JWT and archive recovery key. A short JWT requires the documented maintenance rotation before V2 is enabled.
- Run `node upgrade.mjs check --json` with the same effective database and secret configuration as the application. Upgrading alone does not mark an existing installation as prepared.
- After all replicas use V2, run `node upgrade.mjs prepare --all-replicas-v2 --dry-run`, then the same command without `--dry-run`, followed by `check --json`. Restart replicas after preparation and verify existing credentials.
- Follow the [v17.1.0 preparation runbook](https://github.com/mx-space/core/blob/v17.1.0/docs/v18-preparation.md) for the complete procedure and recovery boundaries. Consumer minimum versions for v18 still require separate verification; this server release does not publish npm packages.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v17.0.5...v17.1.0
