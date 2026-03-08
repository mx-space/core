# @mx-space/webhook

SDK for receiving and verifying MX Space Core webhooks. It provides a signature-verified HTTP handler and an event emitter so you can react to server events (post/note/page/say/comment updates, link applications, activity, etc.) in your own Node.js or edge services.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API](#api)
- [Events & Payloads](#events--payloads)
- [Security](#security)
- [Development](#development)
- [License](#license)

---

## Requirements

- **Node.js** ≥ 22 (see `engines` in `package.json`)
- **MX Space Core** server with webhooks configured; the webhook endpoint must use the same **secret** you pass to `createHandler`.

---

## Installation

From the monorepo root:

```bash
pnpm add @mx-space/webhook
```

Or with npm:

```bash
npm install @mx-space/webhook
```

No framework is bundled; you plug the handler into your own HTTP server (Express, Hono, Node `http`, etc.).

---

## Quick Start

1. **Create a handler** with the same `secret` as in your MX Space Core webhook configuration.
2. **Mount the handler** on the path your server sends webhooks to (e.g. `POST /mx/webhook`).
3. **Subscribe to events** on `handler.emitter`.

```ts
import { createHandler } from '@mx-space/webhook'

const handler = createHandler({ secret: 'your_webhook_secret' })

// Your server: forward raw Node req/res to the handler
yourServer.post('/mx/webhook', (req, res) => {
  handler(req.raw, res.raw)
})

// Listen for specific events (typed payloads)
handler.emitter.on('POST_CREATE', (payload, source) => {
  console.log('New post:', payload.title, 'source:', source)
})

// Catch all events
handler.emitter.on('*', (event) => {
  console.log('Webhook:', event.type, event.payload, event.source)
})

// Handle invalid signature
handler.emitter.on('error', (err) => {
  console.error('Webhook error:', err)
})
```

The handler expects a **parsed JSON body** on the request. It checks `X-Webhook-Signature` (SHA-1) and `X-Webhook-Signature256` (SHA-256), then emits the event and responds with `{ ok: 1 }` or an error payload.

---

## Architecture

- **Handler**: `createHandler({ secret })` returns a function `(req, res) => void` that reads `req.body`, verifies signatures, and emits `type` + `payload` + `source` on an `EventEmitter` attached as `handler.emitter`.
- **Verification**: Uses Node `crypto.createHmac` (SHA-1 and SHA-256) and `timingSafeEqual` to avoid timing attacks. Both `X-Webhook-Signature` and `X-Webhook-Signature256` must be present and valid.
- **Events**: Typed via `BusinessEvents` and `EventPayloadMapping` / `GenericEvent` (from `@mx-space/webhook`). Event source is one of `'admin' | 'visitor' | 'system'` from `X-Webhook-Source` (default `'system'`).
- **Errors**: Invalid signature → `InvalidSignatureError`, HTTP 400 and `{ ok: 0, message: 'Invalid Signature' }`; other errors → HTTP 500.

**File layout:**

- `src/handler.ts` — `createHandler`, `readDataFromRequest`, `verifyWebhook`, `verifyWebhookSha1`.
- `src/event.enum.ts` — re-exports `BusinessEvents`, `EventScope` from core.
- `src/types.ts` — `WebhookEventSource`, `ExtendedEventEmitter`, `EventPayloadMapping`, `GenericEvent`, payload types.
- `src/error.ts` — `InvalidSignatureError`.

---

## API

### `createHandler(options)`

- **Options**: `{ secret: string }`.
- **Returns**: A function `(req, res) => void` with `emitter` attached.  
  - **Request**: Must have `req.body` as the parsed JSON webhook body.  
  - **Response**: Node `ServerResponse`; handler calls `res.statusCode`, `res.setHeader`, `res.end`.

### `handler.emitter`

- **EventEmitter** with typed `on(event, listener)`:
  - For a specific `BusinessEvents` value: `listener(payload, source)`.
  - For `'*'`: `listener(event: GenericEvent)` where `event` has `type`, `payload`, `source`.
  - For `'error'`: invalid signature or other handler errors.

### `readDataFromRequest({ req, secret })`

- Async. Reads and verifies the webhook from `req`; returns `{ type, payload, source }`.  
- Throws `InvalidSignatureError` if verification fails. Useful if you want to handle verification inside your own route and then emit or process the event yourself.

### `verifyWebhook(secret, payload, receivedSignature)` / `verifyWebhookSha1(...)`

- **verifyWebhook**: SHA-256 HMAC comparison.  
- **verifyWebhookSha1**: SHA-1 HMAC comparison.  
- Both use `timingSafeEqual`. Use the same `payload` string (e.g. `JSON.stringify(body)`) and the header value the server sent.

### `InvalidSignatureError`

- Thrown when signature verification fails. Extends `Error` with message `'Invalid Signature'`.

---

## Events & Payloads

Events are defined in the core server and re-exported here. The following are commonly used in the webhook payload types (see `src/types.ts` for full `EventPayloadMapping` and `GenericEvent`):

| Event                     | Payload type (summary) |
|---------------------------|-------------------------|
| `POST_CREATE` / `POST_UPDATE` | Normalized post        |
| `POST_DELETE`             | `{ data: id }`          |
| `NOTE_CREATE` / `NOTE_UPDATE` | Normalized note        |
| `NOTE_DELETE`             | `{ data: id }`          |
| `PAGE_CREATE` / `PAGE_UPDATE` | Page model             |
| `PAGE_DELETE`             | `{ data: id }`          |
| `SAY_CREATE` / `SAY_UPDATE` / `SAY_DELETE` | Say model or id   |
| `RECENTLY_CREATE` / `RECENTLY_UPDATE` | Recently model   |
| `LINK_APPLY`              | Link model              |
| `COMMENT_CREATE` / `COMMENT_UPDATE` | Comment payloads  |
| `ACTIVITY_LIKE`           | Activity like payload   |
| `ARTICLE_READ_COUNT_UPDATE` | `{ count, type, id }` |
| `health_check`            | `{}`                    |

Use the TypeScript types from `@mx-space/webhook` for precise payload shapes when subscribing to specific events.

---

## Security

- **Secret**: Must match the webhook secret configured in MX Space Core. Keep it in environment variables or a secrets manager, not in source.
- **Signatures**: The handler requires both SHA-1 (`X-Webhook-Signature`) and SHA-256 (`X-Webhook-Signature256`) and validates with `timingSafeEqual`.
- **Body**: Verification uses the raw body string. Your server must pass the **parsed** body as `req.body` for the handler to use; ensure the body is not modified before parsing (e.g. use the same raw body for verification if you implement custom verification).

---

## Development

**From repo root:**

```bash
pnpm i
```

**From `packages/webhook`:**

- **Build**: `pnpm run build` — runs `scripts/generate.js` (e.g. type generation), `tsdown`, then `scripts/post-build.cjs` (post-processes `.d.ts`).
- **Output**: `dist/` (CJS + ESM and type definitions).

**Dependencies**: The package re-exports event enums from the core app (`@core/constants/business-event.constant`). In the monorepo, types resolve via workspace; for a published package, ensure you consume a version compatible with your core server.

**Exports:**

- `createHandler`, `readDataFromRequest`, `verifyWebhook`, `verifyWebhookSha1`, `InvalidSignatureError`, `BusinessEvents`, `EventScope`, and all types from `types` and `error`.

---

## License

MIT.
