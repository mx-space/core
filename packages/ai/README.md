# @mx-space/ai

Shared AI building blocks for mx-space: wire contracts, language codes, the model runtime, prompt templates and the translation engine. The package contains pure logic only. It has no NestJS, database or config coupling, so any server can consume it. Data and side effects reach it through small adapter interfaces that the host app implements.

Licensed under MIT.

## Entry points

| Import | Contents |
|--------|----------|
| `@mx-space/ai` | AI agent SSE event schema (`AiAgentSseEvent`), BCP 47 language tags (`canonicalizeLanguageTag`, `isKnownLanguageTag`, `matchLanguage`, `toScriptLevelTag`), environment hooks (`configureAiEnvironment`, `createAiLogger`), `throwIfAborted`, JSON object extraction helpers |
| `@mx-space/ai/runtime` | `IModelRuntime`, `PiRuntimeAdapter`, `createModelRuntime`, provider types (`AIProviderType`, `AIProviderConfig`, ...), protocol adapter registry, JSON Schema to TypeBox conversion, Vertex helpers |
| `@mx-space/ai/decision` | `requestDecision` / `listDecisionModels` for decision (classifier) providers |
| `@mx-space/ai/engine` | Message engine: `Conversation`, `runEngineLoop`, sub-agent tools, `VirtualFs` |
| `@mx-space/ai/prompts` | `AI_PROMPTS`, prompt templates, `renderPromptTemplate`, language name table |
| `@mx-space/ai/translation` | Lexical translation parser, block reuse, Mermaid guard, Markdown paragraph splitter, review pipeline (`TranslationReviewer`), translation agent and coordinator, `LexicalTranslationStrategy`, `MarkdownTranslationStrategy`, `LexicalPartialTranslationBuilder` |

The root entry has no Node-only dependencies and is safe to bundle for the browser. The other entries target Node.

## Host integration

### Logging and debug output

The package logs through `createAiLogger(context)`, which uses `console` until the host registers its own logger:

```ts
import { configureAiEnvironment } from '@mx-space/ai'

configureAiEnvironment({
  debug: process.env.NODE_ENV === 'development',
  loggerFactory: (context) => new Logger(context),
})
```

### Translation strategies

The strategies need two things from the host: a `LexicalDocumentAdapter` (`extractRootBlocks` and `lexicalToMarkdown` for the host's Lexical setup) and a `TranslationReviewer`.

```ts
import {
  LexicalTranslationStrategy,
  TranslationReviewer,
} from '@mx-space/ai/translation'

const strategy = new LexicalTranslationStrategy(lexicalAdapter, new TranslationReviewer())
const result = await strategy.translate(article, 'ja', runtime, info, {
  existing: previousTranslation,
})
```

`existing` is any record shaped like `ExistingTranslation`, so each host keeps its own translation table.

### Language tags

Every stored language is a BCP 47 `language-REGION` tag derived from `Intl.Locale#maximize`: `canonicalizeLanguageTag('zh')` is `zh-CN`, `'zh-Hant'` is `zh-TW`, `'en'` is `en-US`. Legacy shorthands are not aliases: `tw` reads as Twi and `jp`, `cn` are rejected by `isKnownLanguageTag`.

`matchLanguage(requested, candidates)` picks the candidate with the same language and script, preferring an exact region; `zh-HK` finds a `zh-TW` row but never a `zh-CN` one. `toScriptLevelTag` maps a request to the tag new content is generated under (`zh-HK` to `zh-TW`, `en-GB` to `en-US`).

### Workspace consumers

Inside a pnpm workspace the package can resolve its own copy of peer-sensitive dependencies. A bundler that loads the source directly must dedupe `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@innei/message-engine`, `@haklex/rich-headless`, `lexical`, `typebox` and `zod`, or provider registrations end up split across two copies. See `apps/core/vite.config.ts`.

## Development

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsdown (ESM + d.ts, `.md?raw` prompt templates inlined) |
| `pnpm test` | Run the package tests with Vitest |
| `pnpm typecheck` | TypeScript type checking |

Most behaviour tests still live in `apps/core/test/src/modules/ai` and import from this package.
