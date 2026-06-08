## TL;DR

In-app admin dashboard upgrades now resolve through the R2 `latest.json` manifest instead of the archived `mx-space/mx-admin` GitHub Releases, so the upgrade button actually downloads the current admin again.

## Highlights

The admin updater no longer talks to `api.github.com`. `UpdateService` reads `latest.json` from `ADMIN_UPDATE.s3BaseUrl` (default `https://admin-r2.innei.dev`, the bucket both `release.yml` and `admin-release.yml` publish to), downloads the resolved `admin-<version>.zip` directly, and verifies the manifest's `sha256` before installing. Self-hosted operators can point at their own bucket by setting `ADMIN_UPDATE_S3_BASE_URL` or `--admin_update_s3_base_url`.

The cross-version gate in `GET /update/upgrade/dashboard` is relaxed: minor and patch upgrades no longer require `force=true`. Only true major-version jumps are still blocked behind the flag. This matches the new reality where admin ships its own `8.x` semver track decoupled from core's `13.x`, and admin's in-repo monorepo cadence produces frequent patch/minor releases.

The `release.yml` workflow now emits `sha256` in `latest.json` alongside the existing fields, matching `admin-release.yml`'s schema. Both publish paths populate the same manifest contract that the new updater expects.

## Changes

### Features
- Admin in-app updater consumes R2 `latest.json` (with sha256 verification) instead of GitHub Releases. ([31b6e33](https://github.com/mx-space/core/commit/31b6e33c7a5249ea8d3b3ddda12144f07672a9f0))

## Upgrade Notes

No action required for users on the default deployment — the new manifest URL ships baked in. Operators running self-hosted admin buckets should set `ADMIN_UPDATE_S3_BASE_URL` (or `--admin_update_s3_base_url`) to their bucket root before this release lands.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.6.0...v13.7.0
