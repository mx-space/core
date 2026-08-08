# @mx-space/editor

Mx-space business editor contracts and projection utilities built on [Lexical](https://lexical.dev). Framework-neutral: consumed by the admin SPA, the core server, and the CLI alike.

## Exports

| Subpath | Contents |
|---------|----------|
| `@mx-space/editor` | Full surface (barrel over `./core`) |
| `@mx-space/editor/core` | Identical surface, explicit entry |

## Contents

### Projection — Lexical → Markdown

`mxLexicalToMarkdown(state)` walks a `SerializedMxEditorState`, routing stock Lexical nodes through a headless editor (`@lexical/headless` + `@haklex/rich-headless`) and custom blocks through the block registry. Throws `EditorProjectionError` / `UnknownEditorNodeError` on unknown nodes.

### Conversion — legacy Markdown → Lexical

`analyzeMxMarkdown(markdown, options)` parses legacy Markdown into `SerializedMxEditorState` under the `yohaku-v1` profile and returns a discriminated `MarkdownConversionResult` (`convertible` | `blocked`), emitting blocking issues for unsupported features (tilde fences, nested/unclosed fences, bad fence attributes). `MX_MARKDOWN_CONVERTER_VERSION` gates migrations.

### LiteXML serialization

`serializeMxLexicalToLitexml` / `deserializeMxLitexmlToLexical` and friends over `@haklex/rich-litexml`, with `<node type=... data="JSON" />` fallback writers for custom blocks. Used by the CLI's `xml` document output mode.

### Custom block nodes

Type definitions and projections for mx-space's custom blocks, registered in `mxBlockRegistry`:

| Block | Type | Purpose |
|-------|------|---------|
| Map | `map` | Geo map with tracks, POIs, merchants, view state |
| Afilmory | `afilmory` | Photo gallery (grid / masonry / carousel layouts) |
| Stock | `stock` | Stock quote (snapshot / K-line) |

## Usage

```ts
import {
  analyzeMxMarkdown,
  MX_MARKDOWN_CONVERTER_VERSION,
  mxLexicalToMarkdown,
} from '@mx-space/editor'
```

Consumers in this monorepo: [`apps/admin`](../../apps/admin) (rich-editor extensions, draft tooling), [`apps/core`](../../apps/core) (content migration, Lexical helper service), [`packages/cli`](../cli) (Lexical service and content renderer).

## Development

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsdown (ESM, es2022, d.ts) |
| `pnpm test` | Run vitest specs (markdown, conversion, litexml round-trips) |
| `pnpm typecheck` | TypeScript type checking |
