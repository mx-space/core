## TL;DR

This release introduces guided onboarding, restores encrypted backups during setup, and improves translation language handling for regional targets.

## Highlights

New installations now follow a guided setup flow covering the administrator account, site details, AI providers, model assignments, and feature languages. Progress can be resumed, saved settings stay consistent when revisiting steps, and the setup and sign-in screens use the dashboard's shared design system.

Encrypted `.mxbackup` files can now be restored during initial setup using the same recovery-key workflow as the backup settings page. Incorrect keys keep the dialog open for a retry, recovery keys can be imported from a file, and older ZIP archives remain supported. Translation prompts also use region-specific language names when regional targets are supplied.

## Changes

### Features

- Set up a new instance through guided account, site, AI provider, model, and feature steps. ([a9988f2](https://github.com/mx-space/core/commit/a9988f2a3))

### Bug Fixes

- Restore encrypted backups during initial setup, with recovery-key import and retry support shared with the backup settings page. ([#2856](https://github.com/mx-space/core/issues/2856))
- Resume setup reliably and preserve saved account and site settings when revisiting earlier steps. ([9930478](https://github.com/mx-space/core/commit/993047805))
- Handle onboarding edge cases and clarify setup instructions. ([c0a81f1](https://github.com/mx-space/core/commit/c0a81f143))

### Other

- Use regional language names such as Traditional Chinese and Brazilian Portuguese for translation targets, with base-language fallback. ([#2857](https://github.com/mx-space/core/pull/2857))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.0.1...v15.1.0
