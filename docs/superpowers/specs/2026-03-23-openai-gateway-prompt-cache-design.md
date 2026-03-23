# OpenAI Gateway Prompt Cache Design

## Summary

Add Vercel AI Gateway automatic prompt caching to the OpenAI-compatible runtime, but only when the configured `baseURL` points at Vercel AI Gateway. This keeps the optimization scoped to the gateway-specific request extension and avoids leaking Vercel-only fields to unrelated OpenAI-compatible providers.

## Motivation

`OpenAICompatibleRuntime` currently sends plain Chat Completions requests for text, structured output, and streaming. That means Anthropic models accessed through Vercel AI Gateway do not receive `providerOptions.gateway.caching = 'auto'`, so the gateway cannot inject provider-specific cache markers automatically.

## Design Decisions

1. Detect Vercel AI Gateway from the resolved runtime `baseURL`.
2. Inject `providerOptions.gateway.caching = 'auto'` only for gateway-backed requests.
3. Apply the same request decoration to `generateText`, `generateStructured`, and `generateTextStream`.
4. Do not change `OpenRouter` behavior. OpenRouter has its own prompt caching model and request fields.

## Scope

### In Scope

- `apps/core/src/modules/ai/runtime/openai-compatible.runtime.ts`
- runtime-level tests proving gateway-specific request decoration

### Out of Scope

- adding a generic caching toggle to all providers
- changing Anthropic runtime explicit cache behavior
- changing OpenRouter request payloads

## Testing

- Add a failing runtime test that verifies Vercel AI Gateway requests include `providerOptions.gateway.caching = 'auto'`.
- Add a companion test that verifies non-gateway OpenAI-compatible endpoints do not include the field.
