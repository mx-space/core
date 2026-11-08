## TL;DR

The write agent chat panel now folds every turn into one expandable trace row, and messages accept image and text-file attachments.

## Highlights

Each agent turn used to scatter its thinking and tool calls across separate cards that pushed the conversation down the page. They now collapse into a single summary row that expands while the turn is still running and settles into a compact record once it finishes, so a long agent session reads as a conversation rather than a log. Message bubbles, the review card and the composer were restyled alongside it, and newly sent messages animate into place.

Messages in the write agent can now carry images and text files. Images are attached by uploading, pasting with <kbd>Cmd</kbd>+<kbd>V</kbd>, or dragging them onto the composer, and plain-text files are folded into the prompt. The server keeps attachments under a dedicated `/attachments/` path in the agent workspace, sends images to the model as image content, and marks them as user-provided rather than workspace files so the agent does not treat them as editable documents.

Reopening a conversation restores its attachments: transcripts are projected back into history bubbles with their image references and attached-file list intact, so past turns look the same as when they were sent.

## Changes

### Features

- Attach images and text files to write-agent messages; attachments are persisted with the conversation and rehydrated when history is reloaded ([d436a76](https://github.com/mx-space/core/commit/d436a7629e6a262db122596f4cc071a2f95c8e61))
- Fold each turn's thinking and tool calls into one expandable summary row, with restyled bubbles, review card and composer, and an animation for newly sent messages ([d436a76](https://github.com/mx-space/core/commit/d436a7629e6a262db122596f4cc071a2f95c8e61))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v17.0.2...v17.0.3
