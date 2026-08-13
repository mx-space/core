# AI Message Engine Implementation Plan

> 2026-08-14 更新：后续重构已删除 `ContextInjector`、`buildPrefix` 和 `seedConversation`。翻译模块现在通过 `createTranslationConversation()` 直接使用 `AI_PROMPTS.translationAgent()` 与 `translationChunk()` 创建初始会话。本文其余内容保留当时的实施过程，不再作为当前接口说明。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the translation writer/reviewer/editor call orchestration with an append-only agent conversation: the model writes and patches a virtual file via tools, review runs as a sub-agent tool, prefix caching falls out of the message shape.

**Architecture:** A generic `modules/ai/message-engine/` library (virtual FS, append-only conversation, tool types, sub-agent invocation primitive, and a thin harness over `@earendil-works/pi-agent-core`'s `runAgentLoop`) plus a translation binding in `ai-translation/engine/` (four tools, orchestrator). The lexical strategy calls the orchestrator when the runtime supports `streamMessage`; the legacy path stays for markdown and for runtimes without it. Spec: `docs/superpowers/specs/2026-08-06-ai-message-engine-design.md`.

**Tech Stack:** NestJS, `@earendil-works/pi-ai` (Message/Tool types, `streamMessage`), `@earendil-works/pi-agent-core` (agent loop: arg validation, before/after tool hooks, tool-error semantics), TypeBox (`Value.Check`), Vitest + `withFauxAi`/`fauxAssistantMessage`/`fauxToolCall`.

## Global Constraints

- Zero comments/JSDoc except documented workaround or non-obvious invariant (user CLAUDE.md rule).
- **No git commits** — user rule overrides the skill template; every task ends with a verification checkpoint instead.
- Dependency changes (Task 4 only): add `@earendil-works/pi-agent-core@0.83.0`; bump `@earendil-works/pi-ai` `0.82.0 → ^0.83.0` (pi-agent-core requires it). After the bump, `pi-runtime.adapter.spec.ts` and the AI faux suites MUST pass before proceeding.
- Tool/structured outputs validated with `Value.Check`; any `validate: false` pairs with a `Value.Check` within 30 lines (CI gate).
- Lint/typecheck only changed files: `pnpm -C apps/core exec eslint <files>`; run `pnpm -C apps/core exec tsc --noEmit` once per task.
- Tests: `pnpm -C apps/core exec vitest run <file>` (repo root `/Users/innei/git/innei-repo/mx-core`).
- `message-engine/` is a plain library (no NestJS module file — nothing has injectable state; the spec's `message-engine.module.ts` is intentionally dropped, deviation noted for review).
- The legacy pipeline (`callWriterStreaming`, `runReviewAndEditPipeline`, `callEditor`, `reviewer.service.ts`, markdown strategy) is NOT deleted or modified.
- Message-engine files must not import from `ai-translation/` (dependency direction: translation → engine).
- `AbortSignal.any` / `AbortSignal.timeout` are available (Node ≥ 20).

---

### Task 1: Virtual FS

**Files:**
- Create: `apps/core/src/modules/ai/message-engine/vfs/virtual-fs.ts`
- Test: `apps/core/test/src/modules/ai/message-engine/virtual-fs.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  class VirtualFs {
    write(path: string, content: Record<string, string>): void
    read(path: string): Record<string, string>          // copy; {} if absent
    has(path: string): boolean
    applyPatch(path: string, patches: Record<string, string>): {
      appliedKeys: string[]
      droppedKeys: string[]                              // keys not present in the file
      changes: Array<{ key: string; before: string; after: string }>
    }
    replaceInKey(path: string, key: string, find: string, replace: string):
      | { ok: true; before: string; after: string }
      | { ok: false; reason: 'missing-key' | 'find-not-found' | 'find-ambiguous' }
    journal(path: string): Array<{ op: 'write' | 'patch'; keys: string[] }>
  }
  ```
  `replaceInKey` replaces exactly one occurrence; `find` appearing 0 times → `find-not-found`, ≥2 times → `find-ambiguous` (caller tells the model to widen the context). It records a `patch` journal entry on success.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { VirtualFs } from '~/modules/ai/message-engine/vfs/virtual-fs'

describe('VirtualFs', () => {
  it('write then read returns a defensive copy', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: '1' })
    const copy = fs.read('t')
    copy.a = 'mutated'
    expect(fs.read('t')).toEqual({ a: '1' })
  })

  it('applyPatch patches existing keys and drops unknown keys', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: '1', b: '2' })
    const result = fs.applyPatch('t', { a: '1x', ghost: 'nope' })
    expect(result.appliedKeys).toEqual(['a'])
    expect(result.droppedKeys).toEqual(['ghost'])
    expect(result.changes).toEqual([{ key: 'a', before: '1', after: '1x' }])
    expect(fs.read('t')).toEqual({ a: '1x', b: '2' })
  })

  it('replaceInKey replaces a unique occurrence and reports failures', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: 'foo bar foo', b: 'hello world' })
    expect(fs.replaceInKey('t', 'b', 'world', 'there')).toEqual({
      ok: true,
      before: 'hello world',
      after: 'hello there',
    })
    expect(fs.read('t').b).toBe('hello there')
    expect(fs.replaceInKey('t', 'a', 'foo', 'X')).toEqual({
      ok: false,
      reason: 'find-ambiguous',
    })
    expect(fs.replaceInKey('t', 'b', 'absent', 'X')).toEqual({
      ok: false,
      reason: 'find-not-found',
    })
    expect(fs.replaceInKey('t', 'ghost', 'x', 'y')).toEqual({
      ok: false,
      reason: 'missing-key',
    })
  })

  it('journal records write and patch operations in order', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: '1', b: 'hello' })
    fs.applyPatch('t', { a: '2' })
    fs.replaceInKey('t', 'b', 'hello', 'hi')
    expect(fs.journal('t')).toEqual([
      { op: 'write', keys: ['a', 'b'] },
      { op: 'patch', keys: ['a'] },
      { op: 'patch', keys: ['b'] },
    ])
  })

  it('read of unknown path returns empty object; applyPatch on unknown path drops all', () => {
    const fs = new VirtualFs()
    expect(fs.read('missing')).toEqual({})
    expect(fs.has('missing')).toBe(false)
    const result = fs.applyPatch('missing', { a: '1' })
    expect(result.appliedKeys).toEqual([])
    expect(result.droppedKeys).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL** (`Cannot find module .../virtual-fs`)

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/message-engine/virtual-fs.spec.ts`

- [ ] **Step 3: Implement**

```ts
export class VirtualFs {
  private readonly files = new Map<string, Record<string, string>>()
  private readonly journals = new Map<
    string,
    Array<{ op: 'write' | 'patch'; keys: string[] }>
  >()

  write(path: string, content: Record<string, string>): void {
    this.files.set(path, { ...content })
    this.appendJournal(path, { op: 'write', keys: Object.keys(content) })
  }

  read(path: string): Record<string, string> {
    return { ...(this.files.get(path) ?? {}) }
  }

  has(path: string): boolean {
    return this.files.has(path)
  }

  applyPatch(path: string, patches: Record<string, string>) {
    const file = this.files.get(path)
    const appliedKeys: string[] = []
    const droppedKeys: string[] = []
    const changes: Array<{ key: string; before: string; after: string }> = []
    for (const [key, after] of Object.entries(patches)) {
      if (!file || !(key in file)) {
        droppedKeys.push(key)
        continue
      }
      changes.push({ key, before: file[key], after })
      file[key] = after
      appliedKeys.push(key)
    }
    if (appliedKeys.length > 0) {
      this.appendJournal(path, { op: 'patch', keys: appliedKeys })
    }
    return { appliedKeys, droppedKeys, changes }
  }

  replaceInKey(
    path: string,
    key: string,
    find: string,
    replace: string,
  ):
    | { ok: true; before: string; after: string }
    | { ok: false; reason: 'missing-key' | 'find-not-found' | 'find-ambiguous' } {
    const file = this.files.get(path)
    if (!file || !(key in file)) return { ok: false, reason: 'missing-key' }
    const before = file[key]
    const first = before.indexOf(find)
    if (first === -1) return { ok: false, reason: 'find-not-found' }
    if (before.indexOf(find, first + find.length) !== -1) {
      return { ok: false, reason: 'find-ambiguous' }
    }
    const after =
      before.slice(0, first) + replace + before.slice(first + find.length)
    file[key] = after
    this.appendJournal(path, { op: 'patch', keys: [key] })
    return { ok: true, before, after }
  }

  journal(path: string): Array<{ op: 'write' | 'patch'; keys: string[] }> {
    return [...(this.journals.get(path) ?? [])]
  }

  private appendJournal(
    path: string,
    entry: { op: 'write' | 'patch'; keys: string[] },
  ) {
    const list = this.journals.get(path) ?? []
    list.push(entry)
    this.journals.set(path, list)
  }
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Checkpoint** — `pnpm -C apps/core exec eslint src/modules/ai/message-engine/vfs/virtual-fs.ts test/src/modules/ai/message-engine/virtual-fs.spec.ts`

---

### Task 2: Append-only Conversation + context injectors

**Files:**
- Create: `apps/core/src/modules/ai/message-engine/conversation/conversation.ts`
- Create: `apps/core/src/modules/ai/message-engine/conversation/context-injector.ts`
- Test: `apps/core/test/src/modules/ai/message-engine/conversation.spec.ts`
- Test: `apps/core/test/src/modules/ai/message-engine/context-injector.spec.ts`

**Interfaces:**
- Consumes: pi types `AssistantMessage`, `Message as PiMessage` from `@earendil-works/pi-ai`.
- Produces (`conversation.ts`):
  ```ts
  function composeSystemPrompt(sections: Array<string | null | undefined>): string
  class Conversation {
    constructor(systemPrompt: string)
    readonly systemPrompt: string
    get messages(): PiMessage[]                      // shallow copy
    appendUser(text: string): void
    appendAssistant(message: AssistantMessage): void
    appendToolResult(input: {
      toolCallId: string
      toolName: string
      content: string
      isError: boolean
    }): void
  }
  ```
- Produces (`context-injector.ts`) — the injection seam: contributors declare *what*, positions decide *where*; the frozen system and the single context user message are both assembled here, in array order (deterministic → cache-stable prefix):
  ```ts
  interface ContextInjector {
    name: string
    position: 'system' | 'context'
    build: () => string | null | undefined   // null/undefined/'' → injector skipped
  }
  function buildPrefix(injectors: ContextInjector[]): {
    systemPrompt: string                     // system-position sections, composeSystemPrompt semantics
    contextMessage: string | null            // context-position blocks joined by '\n\n'; null if none
  }
  function seedConversation(injectors: ContextInjector[]): Conversation
  // = new Conversation(systemPrompt); appendUser(contextMessage) when non-null
  ```
  Injector `build()` output is used verbatim — block labels (`## Document context …`) belong to the contributor, not the engine. Duplicate injector names throw (`Error('duplicate context injector: <name>')`).

- [ ] **Step 1: Write the failing test**

```ts
import type { AssistantMessage } from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

import {
  composeSystemPrompt,
  Conversation,
} from '~/modules/ai/message-engine/conversation/conversation'

const assistant = (text: string): AssistantMessage =>
  ({
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: 'openai-completions',
    provider: 'faux',
    model: 'faux',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: 1,
  }) as AssistantMessage

describe('composeSystemPrompt', () => {
  it('joins non-empty sections with blank lines and trims trailing space', () => {
    expect(composeSystemPrompt(['a\n', null, 'b', undefined, ''])).toBe(
      'a\n\nb',
    )
  })
})

describe('Conversation', () => {
  it('appends in order and only ever grows', () => {
    const conv = new Conversation('SYS')
    conv.appendUser('u1')
    conv.appendAssistant(assistant('a1'))
    conv.appendToolResult({
      toolCallId: 'tc1',
      toolName: 'review',
      content: '{"issues":[]}',
      isError: false,
    })
    const roles = conv.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'toolResult'])
    expect(conv.systemPrompt).toBe('SYS')
  })

  it('messages getter returns a copy — mutating it does not affect the conversation', () => {
    const conv = new Conversation('SYS')
    conv.appendUser('u1')
    conv.messages.pop()
    expect(conv.messages).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/message-engine/conversation.spec.ts`

- [ ] **Step 3: Implement**

```ts
import type { AssistantMessage, Message as PiMessage } from '@earendil-works/pi-ai'

export function composeSystemPrompt(
  sections: Array<string | null | undefined>,
): string {
  return sections
    .map((section) => section?.trimEnd())
    .filter((section): section is string => Boolean(section))
    .join('\n\n')
}

export class Conversation {
  private readonly list: PiMessage[] = []

  constructor(readonly systemPrompt: string) {}

  get messages(): PiMessage[] {
    return [...this.list]
  }

  appendUser(text: string): void {
    this.list.push({ role: 'user', content: text, timestamp: Date.now() })
  }

  appendAssistant(message: AssistantMessage): void {
    this.list.push(message)
  }

  appendToolResult(input: {
    toolCallId: string
    toolName: string
    content: string
    isError: boolean
  }): void {
    this.list.push({
      role: 'toolResult',
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      content: [{ type: 'text', text: input.content }],
      isError: input.isError,
      timestamp: Date.now(),
    })
  }
}
```

- [ ] **Step 4: Write the failing injector test** (`context-injector.spec.ts`)

```ts
import { describe, expect, it } from 'vitest'

import {
  buildPrefix,
  seedConversation,
} from '~/modules/ai/message-engine/conversation/context-injector'

const sys = (name: string, text: string | null) => ({
  name,
  position: 'system' as const,
  build: () => text,
})
const ctx = (name: string, text: string | null) => ({
  name,
  position: 'context' as const,
  build: () => text,
})

describe('buildPrefix', () => {
  it('assembles system sections and context blocks in array order, skipping empties', () => {
    const prefix = buildPrefix([
      sys('mission', 'MISSION'),
      sys('skipped', null),
      ctx('lang', 'TARGET_LANGUAGE: ja'),
      ctx('doc', '## Document context\nDOC'),
      ctx('empty', ''),
    ])
    expect(prefix.systemPrompt).toBe('MISSION')
    expect(prefix.contextMessage).toBe(
      'TARGET_LANGUAGE: ja\n\n## Document context\nDOC',
    )
  })

  it('returns null contextMessage when no context injector produces output', () => {
    expect(buildPrefix([sys('mission', 'M')]).contextMessage).toBeNull()
  })

  it('throws on duplicate injector names', () => {
    expect(() => buildPrefix([sys('a', 'x'), ctx('a', 'y')])).toThrow(
      /duplicate context injector: a/,
    )
  })
})

describe('seedConversation', () => {
  it('creates the conversation with system prompt and one context user message', () => {
    const conv = seedConversation([
      sys('mission', 'M'),
      ctx('lang', 'TARGET_LANGUAGE: ja'),
    ])
    expect(conv.systemPrompt).toBe('M')
    expect(conv.messages).toHaveLength(1)
    expect(conv.messages[0]).toMatchObject({
      role: 'user',
      content: 'TARGET_LANGUAGE: ja',
    })
  })
})
```

- [ ] **Step 5: Run injector test — expect FAIL, then implement**

```ts
import { composeSystemPrompt, Conversation } from './conversation'

export interface ContextInjector {
  name: string
  position: 'system' | 'context'
  build: () => string | null | undefined
}

export function buildPrefix(injectors: ContextInjector[]): {
  systemPrompt: string
  contextMessage: string | null
} {
  const seen = new Set<string>()
  for (const injector of injectors) {
    if (seen.has(injector.name)) {
      throw new Error(`duplicate context injector: ${injector.name}`)
    }
    seen.add(injector.name)
  }
  const built = injectors.map((injector) => ({
    injector,
    text: injector.build()?.trim() || null,
  }))
  const systemPrompt = composeSystemPrompt(
    built
      .filter(({ injector }) => injector.position === 'system')
      .map(({ text }) => text),
  )
  const contextBlocks = built
    .filter(({ injector, text }) => injector.position === 'context' && text)
    .map(({ text }) => text as string)
  return {
    systemPrompt,
    contextMessage: contextBlocks.length > 0 ? contextBlocks.join('\n\n') : null,
  }
}

export function seedConversation(injectors: ContextInjector[]): Conversation {
  const { systemPrompt, contextMessage } = buildPrefix(injectors)
  const conversation = new Conversation(systemPrompt)
  if (contextMessage) conversation.appendUser(contextMessage)
  return conversation
}
```

- [ ] **Step 6: Run both tests — expect PASS**
- [ ] **Step 7: Checkpoint** — eslint all four files.

---

### Task 3: Sub-agent invocation primitive

**Files:**
- Create: `apps/core/src/modules/ai/message-engine/tools/tool.types.ts`
- Create: `apps/core/src/modules/ai/message-engine/tools/sub-agent.ts`
- Test: `apps/core/test/src/modules/ai/message-engine/sub-agent.spec.ts`

**Interfaces:**
- Produces (`tool.types.ts`):
  ```ts
  interface EngineToolResult { content: string; isError?: boolean }
  interface EngineTool {
    name: string
    description: string
    parameters: TSchema
    execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<EngineToolResult>
  }
  function firstSchemaFailure(schema: TSchema, value: unknown): string
  ```
- Produces (`sub-agent.ts`) — the sub-agent carries its own model/provider (via the runtime), reasoning, timeout, and prompt:
  ```ts
  interface SubAgentSpec {
    runtime: IModelRuntime               // model + provider resolved by the caller
    systemPrompt: string
    reasoningEffort?: ReasoningEffort
    timeoutMs?: number                   // default 180_000
  }
  function invokeSubAgent<T extends TSchema>(
    spec: SubAgentSpec,
    input: { prompt: string; schema: T; signal?: AbortSignal },
  ): Promise<Static<T>>
  ```
  Semantics: one `runtime.generateStructured({ systemPrompt, prompt, schema, reasoningEffort, signal, validate: false })` call guarded by `Value.Check` (throw with `firstSchemaFailure` message on mismatch); the effective signal is `AbortSignal.any([input.signal, AbortSignal.timeout(timeoutMs)].filter(Boolean))`; runtime/validation errors propagate to the caller (tool executors turn them into error tool results). No text-mode fallback — structured-only by design (legacy reviewer.service keeps its own fallback on the legacy path).

- [ ] **Step 1: Write the failing test**

```ts
import { Type } from 'typebox'
import { describe, expect, it, vi } from 'vitest'

import { invokeSubAgent } from '~/modules/ai/message-engine/tools/sub-agent'
import { firstSchemaFailure } from '~/modules/ai/message-engine/tools/tool.types'

const schema = Type.Object(
  { issues: Type.Array(Type.String()) },
  { additionalProperties: false },
)

const runtimeWith = (output: unknown) =>
  ({
    providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => ({ output })),
  }) as any

describe('invokeSubAgent', () => {
  it('returns validated structured output', async () => {
    const runtime = runtimeWith({ issues: ['a'] })
    const result = await invokeSubAgent(
      { runtime, systemPrompt: 'SYS' },
      { prompt: 'P', schema },
    )
    expect(result).toEqual({ issues: ['a'] })
    expect(runtime.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'SYS',
        prompt: 'P',
        validate: false,
      }),
    )
  })

  it('throws with the failing path on schema mismatch', async () => {
    const runtime = runtimeWith({ issues: 'not-an-array' })
    await expect(
      invokeSubAgent({ runtime, systemPrompt: 'SYS' }, { prompt: 'P', schema }),
    ).rejects.toThrow(/issues/)
  })

  it('propagates runtime errors', async () => {
    const runtime = runtimeWith(null)
    runtime.generateStructured = vi.fn(async () => {
      throw new Error('provider down')
    })
    await expect(
      invokeSubAgent({ runtime, systemPrompt: 'SYS' }, { prompt: 'P', schema }),
    ).rejects.toThrow('provider down')
  })
})

describe('firstSchemaFailure', () => {
  it('names the failing path', () => {
    const s = Type.Object({ a: Type.String() }, { additionalProperties: false })
    expect(firstSchemaFailure(s, { a: 1 })).toContain('/a')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement**

`tool.types.ts`:

```ts
import type { TSchema } from '@earendil-works/pi-ai'
import { Value } from 'typebox/value'

export interface EngineToolResult {
  content: string
  isError?: boolean
}

export interface EngineTool {
  name: string
  description: string
  parameters: TSchema
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<EngineToolResult>
}

export function firstSchemaFailure(schema: TSchema, value: unknown): string {
  const [first] = [...Value.Errors(schema, value)]
  if (!first) return 'unknown validation failure'
  return `${first.instancePath || '/'}: ${first.message}`
}
```

`sub-agent.ts`:

```ts
import type { Static, TSchema } from '@earendil-works/pi-ai'
import { Value } from 'typebox/value'

import type { IModelRuntime, ReasoningEffort } from '../../runtime'
import { firstSchemaFailure } from './tool.types'

export interface SubAgentSpec {
  runtime: IModelRuntime
  systemPrompt: string
  reasoningEffort?: ReasoningEffort
  timeoutMs?: number
}

const DEFAULT_SUB_AGENT_TIMEOUT_MS = 180_000

export async function invokeSubAgent<T extends TSchema>(
  spec: SubAgentSpec,
  input: { prompt: string; schema: T; signal?: AbortSignal },
): Promise<Static<T>> {
  const signals = [
    AbortSignal.timeout(spec.timeoutMs ?? DEFAULT_SUB_AGENT_TIMEOUT_MS),
  ]
  if (input.signal) signals.push(input.signal)
  const result = await spec.runtime.generateStructured({
    systemPrompt: spec.systemPrompt,
    prompt: input.prompt,
    schema: input.schema,
    reasoningEffort: spec.reasoningEffort,
    signal: AbortSignal.any(signals),
    validate: false,
  })
  if (!Value.Check(input.schema, result.output)) {
    throw new Error(
      `sub-agent output validation failed at ${firstSchemaFailure(input.schema, result.output)}`,
    )
  }
  return result.output as Static<T>
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Checkpoint** — eslint the three files.

---

### Task 4: Agent loop harness over pi-agent-core

**Files:**
- Modify: `apps/core/package.json` (add `@earendil-works/pi-agent-core@0.83.0`; bump `@earendil-works/pi-ai` to `^0.83.0`; run `pnpm -C apps/core install`)
- Create: `apps/core/src/modules/ai/message-engine/loop/agent-loop.ts`
- Test: `apps/core/test/src/modules/ai/message-engine/agent-loop.spec.ts`

**Interfaces:**
- Consumes: `runAgentLoop` from `@earendil-works/pi-agent-core` (verified surface: `runAgentLoop(prompts, context: { systemPrompt, messages, tools: AgentTool[] }, config: AgentLoopConfig, emit, signal, streamFn)`; `AgentTool.execute(toolCallId, params, signal, onUpdate) → AgentToolResult { content: TextContent[]; details }`, a **thrown error becomes an error tool result**; invalid args become an error tool result without executing; `config.beforeToolCall` returning `{ block: true, reason }` yields an error tool result with `reason`; `StreamFn = (model, context, options) => AssistantMessageEventStream`).
- Consumes: `Conversation` (Task 2), `EngineTool` (Task 3), `IModelRuntime`.
- Produces (same outward surface the later tasks depend on):
  ```ts
  interface LoopGuards {
    maxSteps: number
    toolInvocationLimits?: Record<string, number>
  }
  interface AgentLoopResult {
    finishReason: 'model-finished' | 'max-steps'
    steps: number
    toolInvocations: Record<string, number>
    totalCostUsd: number
  }
  function runEngineLoop(opts: {
    runtime: IModelRuntime
    conversation: Conversation
    tools: EngineTool[]
    guards: LoopGuards
    signal?: AbortSignal
    onToken?: () => Promise<void>
    onCost?: (usd: number) => Promise<void>
  }): Promise<AgentLoopResult>
  ```

Harness semantics (each is a test case):
1. `streamFn` ignores the `model` argument and delegates to `runtime.streamMessage({ messages: context.messages, systemPrompt: context.systemPrompt, tools: context.tools, signal })` — the runtime already embeds provider, model, and credentials. `config.model` is passed as `(runtime.providerInfo as unknown)` cast through a minimal stub `{ provider: runtime.providerInfo.id, id: runtime.providerInfo.model }` (pi only reads `.provider` for API-key lookup, which our runtime does not use).
2. `EngineTool` → `AgentTool` mapping: `label = name`; `execute` calls `tool.execute(params, signal)`; `isError: true` results **throw** `new Error(result.content)` so pi records an error tool result; success returns `{ content: [{ type: 'text', text: result.content }], details: undefined }`.
3. Per-tool invocation limits via `config.beforeToolCall`: over `toolInvocationLimits[name]` → `{ block: true, reason: 'Tool budget for <name> exhausted; finalize without further calls to it.' }` (blocked calls do not count as invocations).
4. `maxSteps` counts assistant turns (via the emit sink's turn events); on breach the harness aborts its internal `AbortController` (chained with the caller signal via `AbortSignal.any`), swallows the resulting abort, and returns `finishReason: 'max-steps'`. A caller-initiated abort rethrows.
5. Every message pi appends during the run (assistant + tool results) is mirrored into `Conversation` in order, so the caller's conversation stays the single source of truth after the run.
6. `totalCostUsd` accumulates `usage.cost.total` from each assistant message; forwarded per turn via `onCost`; `onToken` fires per emitted event (heartbeat).
7. `runtime.streamMessage` absent → throw `TypeError('runtime does not implement streamMessage')`.

- [ ] **Step 1: Bump deps** — edit `apps/core/package.json`, `pnpm -C apps/core install`, then immediately run the adapter gate:

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/pi-runtime.adapter.spec.ts test/src/modules/ai/ai-agent.faux.e2e.spec.ts`
Expected: PASS. If pi-ai 0.83 breaks the adapter, STOP and report — do not patch around it silently.

- [ ] **Step 2: Write the failing test** — stub runtime (same `stubRuntime`/`assistantMsg` helpers as Task 3's style: `streamMessage` returns an async generator yielding `{ type: 'done', message }` per scripted turn). Cases: (a) write→finish happy path mirrors messages into `Conversation` and reports `{ echo: 1 }` invocations; (b) invalid args → error tool result, execute not called; (c) invocation limit → blocked second call, error tool result contains `budget`; (d) maxSteps 2 with an infinite tool-call script → `finishReason: 'max-steps'`, conversation still contains the first two turns; (e) `isError` EngineToolResult surfaces as `isError: true` toolResult message in the conversation.
- [ ] **Step 3: Run test — expect FAIL**
- [ ] **Step 4: Implement the harness** (~90 lines): build `AgentTool[]` per semantics 2, `beforeToolCall` per 3, emit sink per 4-6, delegate to pi `runAgentLoop` with `prompts: []` and `context.messages` seeded from `conversation.messages` (the conversation already holds the context user message appended by the caller).
- [ ] **Step 5: Run test — expect PASS**
- [ ] **Step 6: Checkpoint** — eslint changed files + `pnpm -C apps/core exec tsc --noEmit`.

---

### Task 5: Agent-mode prompt partial + builder (+ reviewer あなた bullet)

**Files:**
- Create: `apps/core/src/modules/ai/prompts/translation-agent-loop.partial.md`
- Modify: `apps/core/src/modules/ai/ai.prompts.ts` (import partial; add `buildTranslationAgentSystem`; add `AI_PROMPTS.translationAgent`; add `export` to `buildTranslationChunkSchema`)
- Modify: `apps/core/src/modules/ai/prompts/translation-reviewer.system.md` (one bullet)
- Test: `apps/core/test/src/modules/ai/ai-prompts.agent-loop.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export const buildTranslationChunkSchema: (textEntries: Record<string, unknown>) => TObject
  AI_PROMPTS.translationAgent(targetLang: string, opts: { reviewEnabled: boolean }): {
    systemPrompt: string
    reasoningEffort: ReasoningEffort   // same value translationChunk uses
  }
  ```
  `systemPrompt` = `buildTranslationChunkSystem(targetLang)` + agent-loop partial; when `reviewEnabled` is false the partial's review-obligation block is replaced by the no-review variant (marker blocks below).

- [ ] **Step 1: Write the partial** — `translation-agent-loop.partial.md` (full content):

```markdown

## Agent mode (supersedes the Output Format above)

You are operating in tool mode. Do NOT print JSON or translations as plain text. Deliver all work through tool calls.

Workflow contract:

1. Translate every entry from "Segments to translate" and submit the complete result in ONE `write_translation` call (`sourceLang` + `translations`, exact keys, group entries as member-id maps).
2. If the tool result reports missing or unresolved ids, call `write_translation` again covering ONLY those ids.
<!-- REVIEW-OBLIGATION-START -->
3. After the file is complete you MUST call `request_review` (no arguments).
4. When the review returns issues, fix them with `patch_translation`. Each edit is `{"id", "find", "replace"}` — `find` must be a unique substring of that segment's current text; omit `find` to replace the whole segment. Fix every occurrence of a flagged pattern across the whole file, not only the cited segment. Then call `request_review` again.
5. Finish (respond with a short plain-text confirmation, no tool call) only when a review returns zero issues or a tool result tells you a budget is exhausted.
<!-- REVIEW-OBLIGATION-END -->
<!-- NO-REVIEW-START -->
3. After the file is complete, finish by responding with a short plain-text confirmation and no tool call.
<!-- NO-REVIEW-END -->

Never invent segment ids. Never leave a segment untranslated unless the rules above say to keep it verbatim.
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'

describe('AI_PROMPTS.translationAgent', () => {
  it('appends the agent-loop contract after the chunk system', () => {
    const { systemPrompt } = AI_PROMPTS.translationAgent('ja', {
      reviewEnabled: true,
    })
    expect(systemPrompt).toContain('## Agent mode')
    expect(systemPrompt).toContain('request_review')
    expect(systemPrompt).toContain('patch_translation')
    expect(systemPrompt.indexOf('## Agent mode')).toBeGreaterThan(0)
  })

  it('keeps the per-language partial (ja ruby present)', () => {
    const { systemPrompt } = AI_PROMPTS.translationAgent('ja', {
      reviewEnabled: true,
    })
    expect(systemPrompt).toContain('ruby')
  })

  it('reviewEnabled=false drops the review obligation', () => {
    const { systemPrompt } = AI_PROMPTS.translationAgent('en', {
      reviewEnabled: false,
    })
    expect(systemPrompt).not.toContain('request_review')
    expect(systemPrompt).toContain('finish by responding')
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**
- [ ] **Step 4: Implement in `ai.prompts.ts`**

```ts
import TRANSLATION_AGENT_LOOP from './prompts/translation-agent-loop.partial.md?raw'

const stripMarkedBlock = (text: string, marker: string) =>
  text.replace(
    new RegExp(`<!-- ${marker}-START -->[\\s\\S]*?<!-- ${marker}-END -->\\n?`),
    '',
  )

const buildTranslationAgentSystem = (
  targetLang: string,
  opts: { reviewEnabled: boolean },
) => {
  const partial = opts.reviewEnabled
    ? stripMarkedBlock(TRANSLATION_AGENT_LOOP, 'NO-REVIEW')
    : stripMarkedBlock(TRANSLATION_AGENT_LOOP, 'REVIEW-OBLIGATION')
  return buildTranslationChunkSystem(targetLang) + partial
}
```

In the `AI_PROMPTS` export object add (copy the `reasoningEffort` value `translationChunk` uses at `ai.prompts.ts:702-716` verbatim):

```ts
translationAgent: (targetLang: string, opts: { reviewEnabled: boolean }) => ({
  systemPrompt: buildTranslationAgentSystem(targetLang, opts),
  reasoningEffort: NO_REASONING,
}),
```

Change `const buildTranslationChunkSchema = (...)` to `export const buildTranslationChunkSchema = (...)`.

In `translation-reviewer.system.md`, under `### Japanese` (~line 127), append to the existing paragraph: `Flag generic second-person あなた in essay prose; prefer subjectless constructions.`

- [ ] **Step 5: Run test — expect PASS. Also run existing prompt suites:**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/ai-prompts-schema.regression.spec.ts test/src/modules/ai/ai-prompts.style-hints.spec.ts`

- [ ] **Step 6: Checkpoint** — eslint changed TS files.

---

### Task 6: Translation tools binding

**Files:**
- Create: `apps/core/src/modules/ai/ai-translation/translation-unit.types.ts` (move `TranslationUnit` + `unitsToEntries`/`unitsToMeta`/`unitsToSourceMap` helpers out of the lexical strategy; strategy re-imports, no behavior change)
- Create: `apps/core/src/modules/ai/ai-translation/engine/translation-tools.ts`
- Test: `apps/core/test/src/modules/ai/ai-translation/translation-tools.spec.ts`

**Interfaces:**
- Consumes: `VirtualFs` (Task 1), `EngineTool` (Task 3), `SubAgentSpec`/`invokeSubAgent` (Task 3), `buildTranslationChunkSchema` + `AI_PROMPTS.translationReviewer` (Task 5 / existing), `REVIEW_WINDOW_SIZE` from `../strategies/base-translation-strategy`, `ReviewerIssue` type from `../reviewer.service`.
- Produces:
  ```ts
  export const TRANSLATION_FILE = 'translation'

  export interface TranslationToolState {
    sourceLang: string | null
    firstWriteAt: number | null
    reviewRounds: number
    reviewerMs: number
    reviewerFailed: boolean
    lastIssues: ReviewerIssue[]
    patchesApplied: Array<{ id: string; before: string; after: string }>
    patchKeysRequested: string[]
    patchKeysDropped: string[]
  }

  export function createTranslationTools(opts: {
    vfs: VirtualFs
    units: TranslationUnit[]
    targetLang: string
    styleHints?: string
    reviewer?: SubAgentSpec               // reviewerRuntime + reviewer system prompt wired by the orchestrator
    onSegments?: (segments: Record<string, string>) => Promise<void>
    signal?: AbortSignal
  }): { tools: EngineTool[]; state: TranslationToolState }
  ```

Behavior (each is a test case):
1. `write_translation` — parameters `buildTranslationChunkSchema(unitsToEntries(units))`. Execute: capture `sourceLang` into state (first write wins), flatten group values to member ids (a group value must be an object covering every member id with strings, else those member ids count as unresolved and nothing partial is written — same tolerance as `parseGroupedTranslation`), merge the flat map into the VFS file, invoke `onSegments` with newly written keys only, return JSON `{ written: string[], missing: string[] }` (`missing` = expected flat ids still absent).
2. `patch_translation` — **search/replace edits, not whole-segment JSON patches**:
   ```ts
   Type.Object(
     {
       edits: Type.Array(
         Type.Object(
           {
             id: Type.String(),
             find: Type.Optional(Type.String({ minLength: 1 })),
             replace: Type.String(),
           },
           { additionalProperties: false },
         ),
         { minItems: 1 },
       ),
     },
     { additionalProperties: false },
   )
   ```
   Execute per edit in order: `find` present → `vfs.replaceInKey(TRANSLATION_FILE, id, find, replace)`; `find` absent → whole-segment replace via `vfs.applyPatch(TRANSLATION_FILE, { [id]: replace })`. Record successes into `state.patchesApplied` (`{ id, before, after }`), all requested ids into `patchKeysRequested`, failures into `patchKeysDropped`; invoke `onSegments` with the updated segments; return JSON `{ applied: string[], failed: Array<{ id, reason }> }` where `reason` ∈ `missing-key | find-not-found | find-ambiguous` — the model retries with wider context or a whole-segment replace.
3. `read_translation` — empty-object parameters; returns the current file as JSON.
4. `request_review` — present only when `opts.reviewer` is set; empty-object parameters. Execute: increment `reviewRounds`; view = `reviewRounds === 1 ? 'monolingual' : 'bilingual'`; flat ids windowed by `REVIEW_WINDOW_SIZE`; per window build the payload via `AI_PROMPTS.translationReviewer(targetLang, { allowedIds: window, segments, styleHints })` where `segments[id] = { target }` (monolingual) or `{ source, target }` (bilingual, source from `unitsToSourceMap(units)`), then `invokeSubAgent(opts.reviewer, { prompt, schema, signal })`; issues filtered to the window's allowed ids (sanitize moves here from reviewer.service); accumulate `reviewerMs`; a window failure is logged and skipped; **all** windows failing sets `reviewerFailed` and returns `{ content: 'reviewer failed; keep current translations and finish', isError: true }`; otherwise merge issues, set `lastIssues`, return JSON `{ issues }`.

- [ ] **Step 1: Write the failing test** — cover: write flatten + missing report + group tolerance + sourceLang capture; patch find/replace success, `find-ambiguous`, `find-not-found`, whole-segment fallback (no `find`), state bookkeeping; review view sequencing (spy `generateStructured` on the reviewer stub runtime: first-call prompt contains no `"source"` key, second does); windowing (65 flat ids → 2 sub-agent calls); all-windows-fail → `isError` result + `reviewerFailed`. Reviewer stub: plain object with `generateStructured: vi.fn()` returning `{ output: { issues: [...] } }`.
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — flat-id helpers live in `translation-unit.types.ts`:

```ts
export const flatIdsOf = (units: TranslationUnit[]) =>
  units.flatMap((unit) => unit.memberIds ?? [unit.id])
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Checkpoint** — eslint changed files + tsc; rerun `test/src/modules/ai/lexical-translation-parser.spec.ts` (strategy helper move must not break imports).

---

### Task 7: Translation context injectors + agent orchestrator

**Files:**
- Create: `apps/core/src/modules/ai/ai-translation/engine/translation-context.ts`
- Create: `apps/core/src/modules/ai/ai-translation/engine/translation-agent.ts`
- Test: `apps/core/test/src/modules/ai/ai-translation/translation-context.spec.ts`
- Test: `apps/core/test/src/modules/ai/ai-translation/translation-agent.faux.e2e.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-6 plus `ContextInjector`/`seedConversation` (Task 2) and `AI_PROMPTS.translationReviewer(...).systemPrompt` (reviewer spec).
- Produces (`translation-context.ts`) — translation's injector instances; each block reproduces the corresponding section of the legacy `buildTranslationChunkPrompt` verbatim:
  ```ts
  export function translationContextInjectors(opts: {
    targetLang: string
    documentContext: string
    units: TranslationUnit[]
    styleHints?: string
    reviewEnabled: boolean
  }): ContextInjector[]
  ```
  Order (fixed): `agent-system` (system, from `AI_PROMPTS.translationAgent(targetLang, { reviewEnabled })`), `target-language` (context, `TARGET_LANGUAGE: ${targetLang}`), `document-context` (context, `## Document context (for semantic reference, DO NOT output this)\n${documentContext}`), `style-context` (context, `## Style context (DO NOT output this)\n${styleHints}`, skipped when absent), `segment-meta` (context, `## Segment metadata (for translation guidance only, DO NOT output this)\n${JSON.stringify(unitsToMeta(units))}`, skipped when empty), `segments` (context, `## Segments to translate\n${JSON.stringify(unitsToEntries(units))}`). A future glossary is one more injector — no builder surgery.
- Produces:
  ```ts
  export const AGENT_MAX_STEPS = 12
  export const AGENT_MAX_REVIEW_ROUNDS = 3

  export async function runTranslationAgent(opts: {
    targetLang: string
    units: TranslationUnit[]
    documentContext: string
    styleHints?: string
    runtime: IModelRuntime
    reviewerRuntime?: IModelRuntime
    signal?: AbortSignal
    onToken?: () => Promise<void>
    onCost?: (usd: number) => Promise<void>
    onSegments?: (segments: Record<string, string>) => Promise<void>
    metrics?: PipelineMetrics
  }): Promise<{ sourceLang: string; translations: Map<string, string> }>
  ```

Behavior:
1. Build `VirtualFs` + `createTranslationTools`; when `reviewerRuntime` present, `reviewer` = `{ runtime: reviewerRuntime, systemPrompt: AI_PROMPTS.translationReviewer(targetLang, { allowedIds: [], segments: {}, styleHints }).systemPrompt, reasoningEffort }` (the reviewer system prompt is payload-independent; per-window user prompts are built inside the tool).
2. `seedConversation(translationContextInjectors({ targetLang, documentContext, units, styleHints, reviewEnabled: Boolean(reviewerRuntime) }))` — frozen system + one context user message assembled through the injector seam.
3. `runEngineLoop` with `guards: { maxSteps: AGENT_MAX_STEPS, toolInvocationLimits: { request_review: AGENT_MAX_REVIEW_ROUNDS } }`.
4. After the loop: read the VFS file; any expected flat id still missing → fill from `unitsToSourceMap(units)` with a warn log (same "falling back to original" behavior as legacy); return the map plus `state.sourceLang ?? ''`.
5. Metrics: `writerMs = state.firstWriteAt - loopStart` (0 if never written); `metrics.reviewer` from state (`invoked: reviewRounds > 0`, `rounds`, `issues: lastIssues`, counts/severity identical to `buildReviewerMetrics`; `skippedReason`: no reviewerRuntime → `'review-disabled'`, wired but zero rounds → `'model-skipped-review'`, `reviewerFailed` → `'reviewer-failed'`); `metrics.editor` from state patches (`invoked` when any applied; `durationMs: 0` — editing happens inside main-thread turns, no separate call to time).
6. `runtime.streamMessage` not a function → throw `TypeError` (caller falls back to legacy).

- [ ] **Step 1: Write the failing injector test** (`translation-context.spec.ts`) — the regression lock tying the injector output to the legacy prompt builder byte-for-byte:

```ts
import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'
import { buildPrefix } from '~/modules/ai/message-engine/conversation/context-injector'
import { translationContextInjectors } from '~/modules/ai/ai-translation/engine/translation-context'
import {
  unitsToEntries,
  unitsToMeta,
} from '~/modules/ai/ai-translation/translation-unit.types'

const units = [
  { id: 'text:p1', payload: '你好', meta: 'text' },
  { id: '__title__', payload: '标题', meta: 'meta.title' },
]

describe('translationContextInjectors', () => {
  it('context message equals the legacy chunk prompt byte-for-byte', () => {
    const { contextMessage } = buildPrefix(
      translationContextInjectors({
        targetLang: 'ja',
        documentContext: 'DOC',
        units,
        styleHints: 'ARTICLE_TYPE: note',
        reviewEnabled: true,
      }),
    )
    const legacy = AI_PROMPTS.translationChunk('ja', {
      documentContext: 'DOC',
      textEntries: unitsToEntries(units),
      segmentMeta: unitsToMeta(units),
      styleHints: 'ARTICLE_TYPE: note',
    }).prompt
    expect(contextMessage).toBe(legacy)
  })

  it('omits the style block when styleHints is absent', () => {
    const { contextMessage } = buildPrefix(
      translationContextInjectors({
        targetLang: 'ja',
        documentContext: 'DOC',
        units,
        reviewEnabled: false,
      }),
    )
    expect(contextMessage).not.toContain('## Style context')
  })
})
```

(`buildPrefix` trims each block's edges; the legacy builder embeds `documentContext` verbatim. The equality holds for edge-whitespace-clean inputs — production document contexts are trimmed upstream. If the assertion ever fails on whitespace only, fix the injector, not the test.)

- [ ] **Step 2: Run — expect FAIL, implement `translation-context.ts`, run — expect PASS**

- [ ] **Step 3: Write the failing faux e2e test** — main runtime via `withFauxAi` + `PiRuntimeAdapter` (pattern: `test/src/modules/ai/ai-agent.faux.e2e.spec.ts`); reviewer runtime is a plain stub with `generateStructured` returning `{ output: { issues: [...] } }` then `{ output: { issues: [] } }`. Scripted main-thread turns:

```ts
responses: [
  fauxAssistantMessage([
    fauxToolCall('write_translation', {
      sourceLang: 'zh',
      translations: { 'text:p1': '訳文A', __title__: '題' },
    }),
  ]),
  fauxAssistantMessage([fauxToolCall('request_review', {})]),
  fauxAssistantMessage([
    fauxToolCall('patch_translation', {
      edits: [{ id: 'text:p1', find: '訳文A', replace: '訳文A改' }],
    }),
  ]),
  fauxAssistantMessage([fauxToolCall('request_review', {})]),
  fauxAssistantMessage('done'),
]
```

Assert: final map has `text:p1 → '訳文A改'`, `sourceLang === 'zh'`, `metrics.reviewer.rounds === 2`, `metrics.editor.patches` contains `{ id: 'text:p1', before: '訳文A', after: '訳文A改' }`, first reviewer prompt lacks `"source"` and second contains it, `onSegments` fired for write and patch. Second test: no `reviewerRuntime` → tools exclude `request_review`, metrics `review-disabled`, write turn + text turn finishes.

- [ ] **Step 4: Run faux test — expect FAIL**
- [ ] **Step 5: Implement `translation-agent.ts`** (≈100 lines) per the behavior list.
- [ ] **Step 6: Run faux test — expect PASS**
- [ ] **Step 7: Checkpoint** — eslint + tsc + rerun `test/src/modules/ai/base-translation-strategy.spec.ts` (legacy pipeline untouched).

---

### Task 8: Lexical strategy integration + full verification

**Files:**
- Modify: `apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts`
- Test: existing `apps/core/test/src/modules/ai/` suite (Task 7's faux spec is the behavior lock)

**Interfaces:**
- Consumes: `runTranslationAgent` (Task 7).
- Produces: no signature changes — `ITranslationStrategy.translate` contract unchanged.

- [ ] **Step 1: Wire the agent path.** In `translateFull` (`lexical-translation.strategy.ts:196`) and `translateIncremental` (`:288`), replace the `translateAllUnits(...)` + `runReviewAndEdit(...)` pair with:

```ts
if (typeof runtime.streamMessage === 'function') {
  const seen = new Set<string>()
  const agentResult = await runTranslationAgent({
    targetLang,
    units: allUnits,
    documentContext,
    styleHints,
    runtime,
    reviewerRuntime,
    signal,
    onToken,
    onCost,
    metrics,
    onSegments: push
      ? async (segments) => {
          for (const [segmentId, value] of Object.entries(segments)) {
            if (seen.has(segmentId)) continue
            seen.add(segmentId)
            await push({
              type: 'partial',
              data: { lang: targetLang, segmentId, partial: value },
            })
          }
        }
      : undefined,
  })
  for (const [id, text] of agentResult.translations) {
    allTranslations.set(id, text)
  }
  sourceLang = agentResult.sourceLang
} else {
  // legacy path: existing translateAllUnits + runReviewAndEdit block, unchanged
}
```

Details per site:
- `translateFull`: `sourceLang` becomes `let sourceLang = ''` assigned per branch; the `if (reviewerRuntime) runReviewAndEdit ... else metrics review-disabled` block moves inside the legacy branch — the agent path sets metrics itself.
- `translateIncremental`: agent path receives only the changed `allUnits`; merge results into the overlay's `allTranslations`; `sourceLang` fallback stays `existing.sourceLang || ''`; `writtenIds` bookkeeping is legacy-branch-only.
- `metrics.writerMs` is set by the agent on the agent branch (drop the outer `writerStart` timing there).

- [ ] **Step 2: Run the translation suites**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/ --exclude "**/*.live.*"`
Expected: all green. `ai-translation.faux.e2e.spec.ts` targets the markdown strategy (legacy) and must be untouched.

- [ ] **Step 3: Full verification sweep** — `pnpm -C apps/core exec tsc --noEmit`; eslint over every file created/modified in Tasks 1-8; `pnpm -C apps/core exec vitest run test/src/modules/configs/`.

- [ ] **Step 4: Update spec status** — set `Status: implemented (step 1)` in the spec; note the design deltas adopted during planning review (pi-agent-core loop, find/replace patches, SubAgentSpec).

- [ ] **Step 5: Report** — summarize deviations for user sign-off. Bench (spec step 2 quality measurement) runs after user review, not in this plan.

---

## Self-Review Notes

- Design deltas from user review of the first plan draft (all incorporated): patch tool uses per-segment find/replace edits with uniqueness check (constrains editor churn, saves tokens; whole-segment replace remains via omitted `find`); sub-agent primitive is a declarative `SubAgentSpec` (runtime = model+provider, systemPrompt, reasoningEffort, timeoutMs) + `invokeSubAgent`; the agent loop is pi-agent-core's `runAgentLoop` behind a ~90-line harness instead of a hand-rolled loop; context assembly is an explicit injector seam (`ContextInjector` + `buildPrefix`/`seedConversation`, Task 2) with translation's injectors in `translation-context.ts` locked byte-for-byte against the legacy chunk prompt (Task 7 Step 1) instead of silently reusing the legacy builder.
- pi-agent-core facts verified against the 0.83.0 tarball: arg-validation and thrown-tool-error → error tool result; `beforeToolCall { block, reason }` → error tool result; `StreamFn(model, context, options)`; `config.model.provider` only read for API-key lookup. Risk: pi-ai bump 0.82 → 0.83 — gated by the adapter spec suite in Task 4 Step 1 with an explicit STOP instruction.
- Spec deviations carried over: no `message-engine.module.ts` (no injectable state); editor `durationMs: 0` (role merged into main thread); forced-finish simplified to stop-and-take-VFS; cost-ceiling guard dropped from the harness (pi loop has no native turn budget either — `maxSteps` + per-tool limits cover the translation case; revisit only if a consumer needs spend caps).
- Reviewer text-mode fallback is legacy-only; the agent path is structured-only via `invokeSubAgent` — a reviewer window failure degrades to skipped-window, all-fail degrades to keep-writer-output, matching today's graceful behavior.
- Type ledger cross-checked: `EngineToolResult.content: string`; `TranslationToolState` field names identical between Task 6 tests and Task 7 metrics mapping; `TranslationUnit`/`unitsToEntries`/`unitsToMeta`/`unitsToSourceMap`/`flatIdsOf` all live in `translation-unit.types.ts` and are consumed by Tasks 6-8; `runEngineLoop` name used consistently (Tasks 4 and 7).
