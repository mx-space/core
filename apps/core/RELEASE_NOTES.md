## TL;DR

AI agents can now edit a draft you have open in the admin editor, live, while draft metadata syncs between tabs in real time.

## Highlights

An agent running `mxs draft cat` and `mxs draft patch` (in `@mx-space/cli`) joins the same collaboration room as the admin write page. Its edits appear in your open editor immediately under a cursor named after the agent, such as "Claude Code", and each one is a single undoable row in the draft history. Text you select in the editor is shared with the agent, even after the editor loses focus.

Draft metadata — slug, category, tags, summary, AI disclosure and paywall — now lives in the draft's collaborative document instead of being saved by a separate request. Two tabs, or a person and an agent, can change different fields at the same time and both changes are kept. Passwords stay out of the shared document and are still saved separately.

Uploads from the image dialog can keep the original file: ticking "Keep original" skips the WebP/WebM conversion. A new media option keeps EXIF and ICC metadata in converted images; comment uploads always strip it.

## Changes

### Features
- Agents edit live drafts through the admin collaboration socket, which now accepts CLI bearer sessions ([8c36cec](https://github.com/mx-space/core/commit/8c36cec693a32ac2fb5cb23c0c76ce12d98f44f5))
- Draft metadata syncs in real time through the collaborative document, and concurrent edits to different fields are both kept ([88045d4](https://github.com/mx-space/core/commit/88045d4e1acea853e145430a062951e2a38ad936))
- The write page shares your selection with collaborators and shows agent cursors by name ([ec7aa17](https://github.com/mx-space/core/commit/ec7aa17540a660bba96eb16200bd3c82af43c8d6))
- Keep-original uploads from the image dialog, and optional image metadata in converted images ([bf14f3f](https://github.com/mx-space/core/commit/bf14f3fd5ea4231de1a418527a6de4ec13bc0e52))

### Other
- The rich editor moves to Lexical 0.53 and supports selecting across blocks in long, virtualized documents ([9e37b71](https://github.com/mx-space/core/commit/9e37b71dd45a47327bab3872002eb1da8deb13d2), [3cfb99a](https://github.com/mx-space/core/commit/3cfb99a6b139b51c39d45bfec2cce4b923c53dcf))
- Better Auth 1.7.14: device approval now shows the verified client identity and requested scopes ([eacaf07](https://github.com/mx-space/core/commit/eacaf07bfb251eb48675aa33ca4361c8b93c37c0))

## Upgrade Notes

- Existing drafts copy their metadata into the collaborative document the first time they are opened; no migration step is needed.
- During a rolling deploy, keep the window short: a metadata edit handled by an old instance can be reverted when a new instance opens that draft.
- `mxs draft cat` / `mxs draft patch` need this server version; older servers refuse the CLI on the collaboration socket.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v16.0.1...v16.1.0
