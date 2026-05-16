## TL;DR

Restores comment-reply email notifications (broken since v12) and inlines built-in templates into the bundle, dropping the external assets repo dependency.

## Changes

- Comment-reply emails now resolve to the correct template filenames again; the v12 PG migration silently shifted the enum values out of step with the template files on disk, so notification mails to commenters and owners have been failing for the past two weeks. ([a549765](https://github.com/mx-space/core/commit/a5497655b9e0d6a2ef880e077022ed2c3f9a4d3c))
- Built-in email and markdown templates are now compiled into the JS bundle via Vite `?raw` imports. The `mx-space/assets` external repo and the `apps/core/assets` symlink are no longer required at runtime, in Docker, or for `pnpm install`. Operators upgrading from source can delete the local `assets/` checkout. User overrides under `$DATA_DIR/assets/` continue to take precedence. ([da4cdd4](https://github.com/mx-space/core/commit/da4cdd48ab5b46aebe51d8ed7d92ce97e0b9a8eb))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.7.0...v12.7.1
