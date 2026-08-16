## TL;DR

Adds reader activity/report endpoints and reader account deletion for the Yohaku Me tab, plus a toggleable App Review demo account for Apple sign-in review.

## Highlights

Readers can now see their own comment history via `GET /comments/reader/me`, flag problematic comments with `POST /comments/:id/report`, and delete their own account through Expo sessions. Together these endpoints back the Yohaku app's Me tab and satisfy app-store account-deletion requirements without any admin involvement.

A new App Review demo account streamlines Apple sign-in review: enabling the toggle provisions a fixed reader identity (`app-review@users.invalid`) that can sign in via the email form even when password login is globally disabled. The account is reset daily by cron, its credentials surface in the admin panel, and disabling the toggle bans the account and cleans up its sessions.

## Changes

### Features

- Reader activity list (`GET /comments/reader/me`), public comment reporting (`POST /comments/:id/report`), and reader self-service account deletion for the Yohaku Me tab ([#2811](https://github.com/mx-space/core/pull/2811))
- App Review demo account behind an admin toggle: idempotent provisioning, email sign-in bypass when password login is disabled, daily content/profile reset, and full cleanup on toggle-off ([#2811](https://github.com/mx-space/core/pull/2811))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.0.2...v14.1.0
