## TL;DR

Realtime moves from socket.io to raw WebSocket with a versioned envelope and Stripe-style event names, plus Apple sign-in support.

## Breaking Changes

- **Realtime transport**: socket.io is gone. Clients connect with a plain WebSocket to `/ws/web` (public) or `/ws/admin` (authenticated) and speak the `{v:1, event, payload?, id?}` JSON envelope; uplinks carrying an `id` receive an `ack` frame. **Migration**: web consumers switch to [`@mx-space/ws-client@0.1.0`](https://www.npmjs.com/package/@mx-space/ws-client) (zero-dependency, browser/Node isomorphic) or any raw `WebSocket`; a reverse proxy in front of core must route Upgrade requests for `/ws/*` to the server.
- **Event names**: every BusinessEvents value is now dot-namespaced — `POST_CREATE` → `post.create`, `fn#` serverless prefix → `fn.`. Webhook deliveries carry the new names. **Migration**: upgrade webhook consumers to [`@mx-space/webhook@1.0.0`](https://www.npmjs.com/package/@mx-space/webhook) and match on the dot-form names; ws subscribers likewise.

## Highlights

The realtime layer is rebuilt on `@nestjs/platform-ws` with an explicit cross-node design: every broadcast — local delivery included — travels through a Redis pub/sub bus, and a Redis-backed presence registry tracks connections and rooms per node with heartbeat GC, atomic Lua room cleanup, and a self-reconciling sweep that both removes entries for dead connections and restores records lost to transient Redis failures. Inbound frames are capped at 1 MiB, matching the old socket.io limit.

Review and live-testing hardening rounds fixed several delivery-critical defects before release: the bus subscription now waits for its Redis client to be ready and retries on later `ready` events (a one-shot failure previously left a node accepting clients but delivering no broadcasts), graceful shutdown reclaims the node's own presence entries, and visitor read-duration analytics are no longer persisted once per hook on disconnect.

Apple sign-in joins the OAuth providers: the server signs the Apple client secret JWT on demand from the team id, key id, and `.p8` key, so the six-month secret expiry never needs manual rotation.

## Changes

### Features
- Sign in with Apple, with on-demand client-secret signing ([55030fb](https://github.com/mx-space/core/commit/55030fb5214ff938bc886a1be89b0984f1392161))
- Raw-ws infrastructure: Redis bus, presence registry, room manager, connection registry, envelope validation ([4c969fd](https://github.com/mx-space/core/commit/4c969fd2462efb0f7d5d999528f973deb68e6121))

### Bug Fixes
- Bus subscription survives a slow or flapping Redis at boot instead of leaving the node broadcast-dead ([1a5cbc7](https://github.com/mx-space/core/commit/1a5cbc7fc84c21afa65b71f456d1a92b1a6942b3), [b50829a](https://github.com/mx-space/core/commit/b50829a6bf5017aca4ed13cc534498a51b7deefe))
- Inbound WebSocket frames capped at 1 MiB; presence records self-heal in both directions during sweeps ([d672d13](https://github.com/mx-space/core/commit/d672d13f4fda6dfa6e17d8b71fbf86a8d17fca5e))
- Graceful shutdown reclaims the node's own connection and room entries; ai-task room subscriptions drop on local emptiness; read-duration analytics deduped on disconnect ([2a24c24](https://github.com/mx-space/core/commit/2a24c24fc3c7401de905dba99a2073d139a51553))
- Phantom presence from a connect/close race no longer inflates the online count ([88d23e2](https://github.com/mx-space/core/commit/88d23e24879fe0d2d67bbd7bf601b26cd2483afc))
- Room cleanup races closed with an atomic Lua check-and-prune ([70d89d5](https://github.com/mx-space/core/commit/70d89d579dd88c42e9cc230fef5985d82d522630))

## Upgrade Notes

Deploy order matters: publish/upgrade consumers against `@mx-space/webhook@1.0.0` and `@mx-space/ws-client@0.1.0`, make sure the reverse proxy forwards WebSocket Upgrade on `/ws/web` and `/ws/admin`, then roll the server. socket.io clients cannot talk to v14, and v13 servers do not serve `/ws/*`.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.30.0...v14.0.0
