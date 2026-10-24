## TL;DR

The write-page AI agent now runs on the server with mid-run steering and visible usage, and LobeHub Cloud joins as an AI provider.

## Highlights

The write-page AI agent now runs its tool loop on the server and talks to the editor over the admin WebSocket. Article search and reading happen server-side, while editor edits stay in the browser for review. You can send a new message while the agent is working and it picks the message up before its next step, instead of waiting for the run to end.

Proposals from the agent are now cumulative: a newer edit replaces earlier unreviewed suggestions rather than piling up conflicting batches, and the agent sees your accepts and rejects as document changes. Each agent reply shows its token usage, prompt cache hit rate, and cost. Conversation history is stored so replayed tool calls keep their exact form, which keeps the provider prompt cache hit across turns.

LobeHub Cloud can be added under Settings → AI as an aggregated provider. Sign in through a device-code flow, pick a default model, and see per-model input, output, and cache pricing. Usage statistics record the cost LobeHub reports and count cache reads and writes separately.

## Changes

### Features
- The write-page agent runs on the server over WebSocket, with steering, cumulative proposals, and a single active run per conversation ([2939e48](https://github.com/mx-space/core/commit/2939e48d177977ac3351d0df5144954d515a9221))
- Agent replies show token usage, cache hit rate, and cost, with tighter Markdown typography ([2939e48](https://github.com/mx-space/core/commit/2939e48d177977ac3351d0df5144954d515a9221))
- LobeHub Cloud provider with device-flow sign-in, model pricing, and cost-aware usage statistics ([b0878bb](https://github.com/mx-space/core/commit/b0878bb3caf420a480a47665fea19789d70f8081))

### Other
- Dynamic components inside the admin editor no longer inherit the editor's text wrapping styles (`@haklex/*` 0.54.4) ([b55f0dc](https://github.com/mx-space/core/commit/b55f0dc5ac112924f92333689e48a081d3e72fbe))

## Upgrade Notes

This release adds migration `0042_agent_transcript` (a nullable `transcript` column on `ai_agent_conversations`). Run the `mx-migrate` step before starting the new image, as with any schema release.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.2.0...v15.3.0
