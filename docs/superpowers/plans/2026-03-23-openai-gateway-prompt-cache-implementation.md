# OpenAI Gateway Prompt Cache Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Vercel AI Gateway automatic prompt caching in the OpenAI-compatible runtime without affecting non-gateway OpenAI-compatible providers.

**Architecture:** Detect whether the runtime resolves to a Vercel AI Gateway base URL, then decorate chat completion requests with `providerOptions.gateway.caching = 'auto'`. Reuse the same helper across text, structured, and streaming calls so behavior stays consistent.

**Tech Stack:** TypeScript, NestJS runtime layer, OpenAI SDK, Vitest, pnpm

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/core/src/modules/ai/runtime/openai-compatible.runtime.ts` | Detect Vercel AI Gateway and decorate request params |
| Create | `apps/core/test/src/modules/ai/openai-compatible.runtime.spec.ts` | Verify gateway-only caching injection |

---

## Chunk 1: Runtime Contract

### Task 1: Lock gateway-only caching behavior with tests

**Files:**
- Create: `apps/core/test/src/modules/ai/openai-compatible.runtime.spec.ts`

- [x] **Step 1: Write the failing test**

Cover:
- Vercel AI Gateway endpoint adds `providerOptions.gateway.caching = 'auto'`
- Non-gateway OpenAI-compatible endpoint does not add `providerOptions`

- [x] **Step 2: Run the targeted test to verify RED**

Run: `pnpm test -- apps/core/test/src/modules/ai/openai-compatible.runtime.spec.ts`

Expected: The gateway-specific assertion fails because the runtime does not yet decorate requests.

### Task 2: Implement gateway request decoration

**Files:**
- Modify: `apps/core/src/modules/ai/runtime/openai-compatible.runtime.ts`

- [x] **Step 1: Add a helper that detects Vercel AI Gateway**

Use the resolved `baseURL` so detection covers normalized endpoints.

- [x] **Step 2: Add a helper that decorates chat completion params**

Inject:

```ts
providerOptions: {
  gateway: {
    caching: 'auto',
  },
}
```

only when the base URL points to Vercel AI Gateway.

- [x] **Step 3: Reuse the helper in all request paths**

Update:
- `generateText`
- `generateStructured`
- `generateTextStream`

- [x] **Step 4: Run the targeted test to verify GREEN**

Run: `pnpm test -- apps/core/test/src/modules/ai/openai-compatible.runtime.spec.ts`

Expected: Both tests pass.

- [x] **Step 5: Run a small related test slice**

Run: `pnpm test -- apps/core/test/src/modules/ai/ai-provider.factory.spec.ts apps/core/test/src/modules/ai/openai-compatible.runtime.spec.ts`

Expected: Existing runtime factory coverage still passes.
