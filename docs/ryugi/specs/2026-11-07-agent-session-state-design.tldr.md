# TL;DR: Agent session state owned by the server

## What gets built
The server transcript becomes the only conversation history. The client sends hashes and patches instead of full payloads. The table is rebuilt and old data dropped. Ships in a breaking core major.

## What you'll see
1. Run the migration: `ai_agent_conversations` is empty, and it has no `messages` column.
2. Start a new chat in the editor: no REST create call. The conversation id arrives in the `agent.run` ack.
3. Send a second message: the WS frame carries `systemHash`, `toolsHash` and file patches, not full text.
4. Reload the page and reopen the chat: history shows thinking, tool calls and diff cards. Large tool outputs show as previews.
5. Accept or reject a diff: only a small `PUT …/review-state` goes out.

## Decisions
| Topic | Decision |
|---|---|
| Source of truth | Server transcript |
| Review state | `review_state` column |
| System / tools | Hash refs, per-connection cache |
| Files | Base hash + patch, NACK → full resend |
| Conversation creation | Server, on `agent.run` |
| History load | Server-projected compact bubbles |
| Old data / compatibility | Dropped / none; breaking major |

## Check these (builder calls)
- Table dropped and recreated rather than altered. `model`, `provider_id` and `transcript` become NOT NULL.
- `review_state` = `{ reviewState, anchors }`. anchors locate diff cards in history.
- Tool results over 4 KB become previews. Edit ops and dynamic-card results stay full.
- A new document's first run uses a temp UUID session. It is re-keyed via PATCH once the doc has an id.
- SHA-256 hashes, using one serializer shared by both sides.

## Time
About 4–6 hours of implementation plus tests, across core, admin, `packages/ai`, `ws-client` and `db-schema`.
