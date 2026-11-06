## TL;DR

The editor AI agent now keeps its conversation history on the server, sends far less data per message, and can edit paywall settings.

## Breaking Changes

- **AI agent conversations**: the conversation table is rebuilt so the server-side transcript is the only stored history; every existing agent conversation is discarded during the upgrade. **Migration**: run the release migration (`mx-migrate`) as usual before the new pods start; no data needs to be exported, since previous agent chats cannot be carried over.
- **Admin ↔ server agent protocol**: the admin agent now talks a new WebSocket protocol, and neither side accepts the previous payload shape. **Migration**: upgrade the server and the bundled admin together, and reload any admin tab that was open during the deploy.

## Highlights

Agent conversations now live entirely on the server. A conversation is created the moment you send your first message, its full transcript (thinking, tool calls and results) is the single record, and reopening a conversation shows exactly what the model saw instead of a partial chat log. Review proposals are saved alongside it, so pending suggestions come back after a reload.

Long editing sessions are much lighter. After the first message, the agent's instructions and tool definitions are referenced by hash instead of being resent, and the article is sent as a small patch of what changed rather than the whole document on every turn. Large tool outputs are shown as previews when history is reopened.

The agent can now read and change a post's paywall settings — premium status, purchase availability, free window and preview length — and invalid values are rejected with a clear reason instead of being silently coerced.

## Changes

### Features
- Agent conversation history is stored once on the server and reopened from it, with review proposals restored ([ad8dc5e](https://github.com/mx-space/core/commit/ad8dc5ef0d13b94c6a1c6aa2cb8c0deb3090d265))
- Agent messages send only hashes and patches after the first turn, cutting per-message traffic on long sessions ([ad8dc5e](https://github.com/mx-space/core/commit/ad8dc5ef0d13b94c6a1c6aa2cb8c0deb3090d265))
- The editor agent can read and edit post paywall fields ([cbd5c18](https://github.com/mx-space/core/commit/cbd5c18d2a536e8c7501de95b23ba8eef73c55ac))

### Bug Fixes
- Sign-in and sessions run on Better Auth 1.7.16 ([12a1bac](https://github.com/mx-space/core/commit/12a1bac79bde8d62d255f9f1104fc60eb43dbf10))
- Rebuilding an imported collaborative draft keeps its public fields ([b7170de](https://github.com/mx-space/core/commit/b7170dead5f9b9a5f56bb24508d5662ea6e9e373))

## Upgrade Notes

Deploy the server and admin from this release together. Agent chats from earlier versions will be gone after the migration; everything else is unaffected.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v16.4.1...v17.0.0
