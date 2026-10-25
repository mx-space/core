# Realtime collab room over WebSocket

Date: 2026-10-25
Status: approved 2026-10-25
Phase 2 of 4 in the collaborative editing track
(`2026-10-25-loro-content-storage-design.md`, "Track").

## Intent

Phase 1 made one Loro doc per Lexical document the source of truth and synced
it over HTTP: ~100 ms POST batches up, a `draft.update` signal, then a
`GET ?since=` pull down. That works, but every remote keystroke costs a signal
plus a round trip, and nobody can see where anyone else is.

This phase moves the doc sync onto the admin WebSocket as `collab.*` frames
and adds presence: who has the document open, and a named caret for each of
them. It is the transport phase 3 (server AI peer) and phase 4 (co-authors)
plug into, so the room must not assume that every member is the owner.

## Goals

- Updates reach the server and every other open editor in one WS frame each
  way, without a pull.
- Each member sees the others: an avatar stack in the write-page header, and a
  colored caret with a name label (plus the selected range) inside the editor.
- Rooms span replicas (two pods behind Dokploy) through the existing Redis WS
  bus.
- The HTTP endpoints from phase 1 keep working and stay the fallback while the
  socket is down, for the CLI and for old admin builds during cutover.
- Server-side doc changes (restore, undo, legacy write, cutover reconcile)
  reach open editors immediately.

## Non-goals

- Server-side AI peer and its caret (phase 3). This phase leaves room for a
  non-connection member, but ships none.
- Readers, invites, reader auth (phase 4). Phase 2 rooms only see the owner's
  connections, because `/ws/admin` only admits the owner.
- Client-side persistence of unsent updates (still none, as in phase 1).
- Live-syncing metadata fields between tabs (still not synced, phase 1 ruling).
- Comments, follow-me scrolling, per-user undo stacks.

## Decisions (designer's calls, for the author to confirm)

1. **Transport is the existing `/ws/admin` socket**, events registered through
   `AdminWsHandlerRegistry` like `agent.*`. No second socket. Phase 4 mounts
   the same room service on a reader-authenticated gateway.
2. **Binary in JSON.** The envelope is JSON (`{v, event, payload, id}`), so
   Loro bytes travel base64 in the payload. Updates larger than 512 KiB after
   encoding go through the phase 1 `POST /drafts/:id/crdt` instead (the socket's
   `maxPayload` is 1 MiB; the HTTP route allows 4 MiB).
3. **The server stays authoritative and stateless per frame.** A `collab.update`
   goes through the same `importUpdate` path as the HTTP POST (vet on a fork,
   append, compaction). Only after the append succeeds is the update relayed to
   the room. A rejected update is acked `ok:false` with the same code, and the
   client runs the phase 1 rejection recovery.
4. **Presence is ephemeral and serverless.** Clients keep a Loro
   `EphemeralStore` (awareness) per document and exchange its encoded deltas as
   `collab.presence` frames that the server relays without storing. A joining
   member triggers `collab.peer.joined`, and every member answers by sending its
   full presence once, so late joiners catch up without server state. Entries
   expire after 30 s without a refresh; clients refresh every 10 s.
5. **Carets are anchored to Loro tree ids, not Lexical keys.** A position is
   `{ id: TreeID, offset }` (text node id from `binding.idOf`), so it means the
   same thing in every editor; the receiver maps it back with `binding.keyOf`.
6. **Identity.** Phase 2 presence shows the owner's name and avatar, a
   per-connection color, and a "this device / other tab" distinction by
   connection id. Each tab is its own member; two tabs of the owner show two
   carets.
7. **`draft.update` keeps firing** after every append (HTTP or WS), unchanged,
   for old admin builds and the drafts list. New clients in a room ignore it for
   content sync.
8. **Access check is one replaceable function** `canJoin(member, documentId)`;
   phase 2's implementation is "the connection is on `/ws/admin`".

## Protocol

All events ride the `@mx-space/ws-client` envelope. Requests carry `id` and get
an `ack` (`{ ok, code?, data? }`). Server pushes have no `id`.

Client → server:

| Event | Payload | Ack data |
| --- | --- | --- |
| `collab.join` | `{ draftId, since?: base64 VV }` | `{ documentId, update: base64, presence: [] }` — snapshot when `since` is absent, else the updates the client lacks |
| `collab.update` | `{ draftId, update: base64 }` | — (`ok:false, code: DRAFT_CRDT_UPDATE_REJECTED` on rejection) |
| `collab.presence` | `{ draftId, state: base64 }` (encoded `EphemeralStore` delta) | — |
| `collab.leave` | `{ draftId }` | — |

Server → room members:

| Event | Payload | Sent to |
| --- | --- | --- |
| `collab.update` | `{ documentId, update: base64 }` | room, excluding the sender's connection |
| `collab.presence` | `{ documentId, state: base64 }` | room, excluding the sender |
| `collab.peer.joined` | `{ documentId, connectionId }` | room, excluding the joiner |
| `collab.peer.left` | `{ documentId, connectionId }` | room |

Room name: `collab:<documentId>`. `draftId` is accepted on the wire because
that is the id the write page holds; the server resolves it to the document
and its working copy exactly as the HTTP routes do (any branch id of a Lexical
document reaches its working copy).

## Server

- `CollabRoomService` (draft module): `join`, `update`, `presence`, `leave`,
  `disconnect(connectionId)`. Holds no document state. It calls
  `DraftCrdtService` for snapshots/updates, `canJoin` for access, and a sink
  interface for "send to room except X" so the gateway owns sockets.
- The admin gateway registers the four events through
  `AdminWsHandlerRegistry` and a disconnect listener that turns into
  `collab.peer.left` for each room the connection was in.
- Room membership uses the gateway's existing `WsRoomManager` + `WsPresenceService`
  (per-pod membership, Redis presence index). Fan-out uses `bus.publish` with
  `rooms` and `exclude`, so members on the other pod receive the frame.
- **Every doc change is relayed.** `DraftCrdtService` gains one hook,
  `onDocumentChanged(documentId, update, origin)`, called after any append:
  client imports (HTTP or WS) and server-side edits (restore, undo, legacy
  write, reconcile, import). `CollabRoomService` subscribes and relays
  `collab.update` to the room, excluding `origin` when the change came from a
  connection. Server-side edits therefore show up live in open editors.
- Frame size: the gateway rejects a `collab.update` whose decoded update
  exceeds the HTTP limit (4 MiB) the same way the POST does.
- Rate: no extra limiting in phase 2 (owner only). Phase 4 adds per-member
  limits.

## Client (admin write page)

- `crdt-sync` gets a transport interface with two implementations: the phase 1
  HTTP one, and a WS one built on `getAdminSocket()`. The WS transport is used
  while the socket is `open`; on `reconnecting`/`closed` the session falls back
  to HTTP push and pull, and on reopen it re-joins with `since` = local oplog
  version and pushes anything unsent (`sent` vector logic is unchanged).
- Incoming `collab.update` frames are imported through the binding (as pulls
  are today). The `draft.update` → pull path stays only for the HTTP fallback.
- Presence: `crdt-draft-session` owns an `EphemeralStore`. On every editor
  selection change (debounced 50 ms) it writes
  `{ user: { name, avatar, color }, anchor, focus }` with tree-id anchors, and
  clears the caret on blur. Remote states render as:
  - a caret + name label at `focus`, and a translucent highlight over the
    `anchor..focus` range, drawn in an overlay like `apps/admin/src/author/AgentCursor.tsx`;
  - an avatar stack (max 4 + "+N") in the write-page header, tooltip with name
    and "other tab" for the owner's own other connections.
- Colors: a fixed palette of 8, picked by hashing the connection id.

## Failure modes

- **Socket drops mid-push.** The update stays `dirty` in `crdt-sync`; after
  fallback or reconnect it is re-sent. Loro import is idempotent, so a frame
  that reached the server before the drop costs nothing when re-sent.
- **Pod restart.** Members reconnect, re-join with `since`, and miss nothing,
  because the doc lives in PostgreSQL and the join ack carries what they lack.
- **Relay ordering across pods.** Loro tolerates out-of-order updates; an
  update whose deps have not arrived is held as pending by the client doc and
  applied when they do. The join ack's catch-up closes any gap.
- **Presence for a gone member.** Expires after 30 s; `collab.peer.left` clears
  it immediately when the disconnect is seen.

## Testing

- Core: `CollabRoomService` unit tests with a fake sink (join returns snapshot /
  catch-up, update relays to others only after a successful append, rejected
  update acks `ok:false` and relays nothing, presence relays without storage,
  disconnect emits `peer.left`). PG e2e: a restore relays an update that brings
  a second doc to the same state.
- Gateway: handler wiring through the registry, using the existing gateway
  spec patterns.
- Admin: WS transport against a fake socket (join catch-up, push, fallback to
  HTTP on close, rejoin with `since`); presence encode/decode and tree-id
  anchoring through a real binding; caret overlay component test.

## Verification (end to end)

Two browsers on the local stack: both see each other's avatar and caret,
typing in one shows up in the other without any `GET /crdt` request in the
network log, a restore from the timeline appears in the other tab live, and
killing/restarting the core process loses no edit after reconnect.
