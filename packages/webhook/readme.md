# Mix Space Core Webhook SDK

```bash
pnpm install @mx-space/webhook
```

## Usage

```ts
const handler = createHandler({
  secret: 'your_secret',
})

ctx.server.post('/mx/webhook', (req, res) => {
  handler(req.raw, res.raw)
})

handler.emitter.on(event, callback)
```

## MIT