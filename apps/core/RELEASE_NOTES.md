## TL;DR

Updating an article now reuses the AI resources chosen at its last publish, so CLI updates no longer silently skip summaries or translations.

## Highlights

Each article now remembers which AI resources (summary, insights, translation, TTS) were chosen at its last publish, and whether publishing waited for each one. When a publish job leaves the AI selection out, the server falls back to that remembered choice instead of generating nothing. Passing an explicit list, including an empty one, replaces the remembered choice once the publish succeeds.

The admin publish dialog now opens with the article's remembered choices instead of a browser-local default. In the CLI, `post`/`note` `update`, `edit` and `apply` inherit the last choices automatically; `mxs draft publish --ai none` clears them.

## Changes

### Features

- Publish jobs reuse each article's last AI resource choices when none are given ([4156d29](https://github.com/mx-space/core/commit/4156d296775380f6075499d74b3fde19ff43cb18))

### Other

- Upgraded major dependencies, including pi-ai, nodemailer, jotai, dotenv, zod-compiler and unplugin-swc, and moved the editor stack to `@haklex/*` 0.46.0 with lexical 0.52.0 ([6a0bd8d](https://github.com/mx-space/core/commit/6a0bd8d90), [49c309a](https://github.com/mx-space/core/commit/49c309a4d))

## Upgrade Notes

- This release adds a nullable column (`content_documents.publish_ai_resources`). Run the `mx-migrate` step before starting the new image; the app refuses to boot until the schema is current.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.15.1...v14.15.2
