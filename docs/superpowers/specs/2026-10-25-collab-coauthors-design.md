# Co-authors: invites, reader editing, byline

Date: 2026-10-25
Status: approved
Phase 4 of 4 in the collaborative editing track
(`2026-10-25-loro-content-storage-design.md`, "Track"). Builds on phases 2
(`2026-10-25-collab-realtime-room-design.md`) and 3
(`2026-10-25-collab-ai-peer-design.md`).

## Intent

The owner can now co-write with their own tabs and an AI peer. This phase lets
the owner invite readers into one document: they sign in with an existing
reader OAuth provider, edit the body and title live in the same room, see and
are seen, and are credited in the published article's byline. The track's
original "per-document AI quota" item is dropped: co-authors get no AI (author's
decision), so nothing spends the owner's model budget on their behalf.

## Goals

- The owner creates an invite link for a Lexical document, revokes it, lists
  collaborators and removes them.
- A reader opens the link, signs in with a configured OAuth provider, accepts,
  and lands on a co-author page at `#/collab/:documentId` in the admin SPA.
- Co-authors edit the body and title through the same Loro room, with carets
  and avatars, HTTP fallback included. They cannot read or change metadata
  fields, checkpoints, history, sharing, or publish.
- Every presence entry and every commit message from a co-author is bound to
  their server-side identity.
- Co-authors who actually edited, and whom the owner keeps listed, appear as
  `coAuthors` on the post/note read APIs.

## Non-goals

- File and image uploads by co-authors (upload endpoints stay owner-only; the
  co-author editor hides upload actions).
- Co-authors creating documents, or access to more than the invited document.
- Comments, suggestions mode, per-co-author undo or history UI.
- AI for co-authors: no agent panel on the co-author page, no `agent.*`
  handlers on `/ws/web`, no quota or usage tracking. The owner's own agent
  still edits the shared document as in phase 3.
- Rendering the byline in Yohaku (separate repo); this phase exposes the data
  and updates `@mx-space/api-client` types.
- Email invitations (links only).

## Decisions (designer's calls, for the author to confirm)

1. **Data (additive migration 0044, two tables).**
   - `content_collaborators`: `id`, `document_id` (FK cascade), `reader_id`
     (FK cascade), `show_in_byline bool default true`, `contributed_at` (null
     until their first accepted update), `created_at`; unique
     `(document_id, reader_id)`.
   - `content_collab_invites`: `id`, `document_id` (FK cascade), `token_hash`
     (sha256 of a 32-byte random token; the token itself is shown once),
     `expires_at` (default 7 days), `max_uses` (null = unlimited), `uses`,
     `revoked_at`, `created_at`.
2. **Invite flow.** Link `…/#/collab/join/<token>` (public route). Signed-out
   readers see the enabled OAuth providers and sign in with `callbackURL` back
   to the link. `POST /collab/invites/:token/accept` (reader session) checks
   expiry, revocation and use count, upserts the collaborator, and returns the
   document id. The owner opening the link is sent to the write page.
3. **Co-authors connect on `/ws/web`.** That gateway already resolves the
   reader from the session cookie, so `collab.*` handlers are registered there
   too, with `canJoin` = owner, or a reader who is a collaborator of the
   document. `/ws/admin` stays owner-only. The room relay publishes to both
   namespaces so owner and co-authors share one room.
4. **HTTP fallback for co-authors:** `GET/POST /collab/documents/:id/crdt`
   (reader session + collaborator guard), same vetting as the owner route.
   `GET /collab/documents/:id` returns title, kind, my identity, and the
   collaborator list (name, avatar). Nothing else of the document is exposed.
5. **Bound attribution.** A co-author's update is rejected unless every change
   in it carries `human:<their readerId>` (checked in `vetUpdate` with the
   expected reader); co-authors have no agent, so `agent:` is refused too.
   The owner keeps `human:owner` and `agent:` for their own agent.
6. **Presence becomes server-stamped JSON** (replacing Loro `EphemeralStore`,
   which also fixes the clock-skew minor from phase 2). A client sends
   `{ caret, entry? }`; the server relays `{ connectionId, entry, user, caret }`
   with `user` taken from the session (agent entries get `{ name: 'AI' }`).
   Clients key entries by `connectionId` (+ `entry`), take `user` only from the
   server, and expire entries on local receive time. Avatars therefore only
   come from reader records.
7. **Rate limit.** Non-owner members get a per-connection token bucket on
   `collab.update` / `collab.presence` (60 frames/s, burst 120); excess frames
   are acked `RATE_LIMITED` and dropped.
8. **Co-author page.** A public route with its own reader gate renders the
   title, the rich editor bound to the room, avatars and carets. No agent
   panel, metadata form, timeline, share, publish or uploads.
9. **Byline.** `coAuthors` = collaborators with `contributed_at` set and
    `show_in_byline`, ordered by first contribution: `{ name, avatar, url }`
    from the reader record. Returned on post and note detail responses
    (snake_case on the wire) and typed in `@mx-space/api-client`.
10. **Owner UI.** A "Collaborators" panel next to the timeline on Lexical
    documents: create link (copy), active links with revoke, collaborators
    with byline toggle and remove. The timeline labels
    co-author steps with the co-author's name.
11. **Removal is immediate.** Removing a collaborator or revoking access
    closes their open room membership (server sends `collab.revoked` and drops
    them from the room); their past edits stay.

## Known limitation

Co-authors receive the full Loro document, oplog included, so text deleted
before they joined can be recovered with developer tools. A shallow snapshot
would hide it but rejects concurrent owner ops whose dependencies predate the
shallow root, which breaks live editing. The author accepted this; the
co-authors panel states it next to the invite button.

## Testing

- Core: repository specs for the two tables; invite accept (expired,
  revoked, exhausted, idempotent re-accept); `canJoin` for owner, collaborator,
  stranger; `vetUpdate` attribution rule; presence stamping; rate limiter;
  `coAuthors` on post/note detail; contract
  specs for the new endpoints and envelope.
- Gateway e2e: a reader socket on `/ws/web` joins a document it collaborates
  on and exchanges updates with an owner socket on `/ws/admin`; a stranger is
  refused; removal kicks the member out.
- Admin: join page (signed out / accepted / invalid link), co-author page
  wiring, collaborators panel, presence rendering from stamped frames.

## Verification (end to end)

Local stack, owner in browser A, a reader (temporary local session for an
existing reader row) in browser B: A creates a link; B opens it, accepts, and
lands on the co-author page; both edit live with named carets; the
co-author page shows no agent panel; A removes B and B is dropped from
the room; publishing the post returns B in `coAuthors`.
