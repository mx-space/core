# Lexical Poll Node Translation — Design

**Date:** 2026-05-12
**Owner:** Innei
**Status:** Draft

## Problem

The AI translation pipeline walks the Lexical editor state via
`apps/core/src/modules/ai/ai-translation/lexical-translation-parser.ts` and
emits two segment kinds:

- `TranslationSegment` for inline `text` leaves.
- `PropertySegment` for whitelisted node-level string fields (currently
  `details.summary`, `footnote-section.definitions[key]`, `ruby.reading`),
  surfaced through `extractLexicalTranslatableProperties` in
  `apps/core/src/utils/lexical-translatable-property.util.ts`.

The Poll node (`type: 'poll'`, defined in
`haklex/packages/rich-ext-poll/src/nodes/PollNode.ts`) carries two
translatable surfaces:

- `question: string`
- `options: Array<{ id: string; label: string }>` (size >= 2)

Neither surface is text-typed and Poll is not in the property whitelist, so
the parser passes through Poll silently and AI translation never touches
either field. Translated posts therefore render the poll in its source
language while the surrounding prose is localised.

## Goals

1. Translate `poll.question` and every `poll.options[i].label` end-to-end
   (parse → request to LLM → restore).
2. Preserve all non-translatable Poll metadata verbatim across the round
   trip: `pollId`, `options[i].id`, `mode`, `closeAt`, `showResults`,
   `version`, `type`.
3. Keep the change additive — existing Lexical translation behaviour for all
   other node types is unchanged.

## Non-Goals

- Translating poll vote results, tallies, or any runtime poll state. The
  PollNode `decorate()` output is computed at render time from the data
  adapter; translation only mutates the serialised authoring data
  (`question`, `options[].label`).
- Splitting `question` / `option.label` into multiple inline runs. They are
  flat strings and remain flat strings post-translation.
- Adding Poll support to the property whitelist
  (`extractLexicalTranslatableProperties`). See "Why not the whitelist"
  below.

## Approach

Add a parser-level special case for `node.type === 'poll'`, modelled on the
existing Excalidraw branch (`LEXICAL_CONTEXT_EXCALIDRAW_TYPE`) that already
emits multiple `PropertySegment`s against different `node` references from a
single source node.

### Parser changes

In `lexical-translation-parser.ts`:

1. Add a helper `extractPollSegments(node, propertySegments, counter, ctx)`:
   - If `typeof node.question === 'string' && node.question.trim()`, push:
     ```ts
     { id: `p_${counter.p++}`, text: node.question, node, property: 'question',
       blockId: ctx.blockId, rootIndex: ctx.rootIndex }
     ```
   - If `Array.isArray(node.options)`, iterate each `option`. When
     `typeof option.label === 'string' && option.label.trim()`, push:
     ```ts
     { id: `p_${counter.p++}`, text: option.label, node: option, property: 'label',
       blockId: ctx.blockId, rootIndex: ctx.rootIndex }
     ```
     The `node` reference points at the option object so the existing
     restore path (`prop.node[prop.property] = translated`) writes back to
     `option.label` directly.
2. In `walkNode`, insert the Poll branch immediately after the Excalidraw
   branch and before the skip-block / skip-inline checks:
   ```ts
   if (node.type === 'poll') {
     extractPollSegments(node, propertySegments, counter, ctx)
     return
   }
   ```
   Poll is a `DecoratorNode` with no `children`, so `return` after extraction
   matches its actual shape and avoids descending into `options` via
   `scanNestedEditorStates` (which would otherwise inspect every non-known
   property and reject `options` as not a nested editor state — harmless,
   but the explicit return makes intent clear).

### Restore path

No changes. `restoreLexicalTranslation` already handles `PropertySegment`
via:

```ts
if (prop.key !== undefined) {
  prop.node[prop.property][prop.key] = translated
} else {
  prop.node[prop.property] = translated
}
```

Since the Poll segments are emitted with `key === undefined` and `node`
pointing at either the poll node (for `question`) or the specific option
object (for `label`), the existing string path produces the correct
mutation. The option object reference survives because the parser does not
clone the editor state — `parseLexicalForTranslation` calls `JSON.parse`
once and all downstream `node` references point into that single object
tree, which is then re-stringified by `restoreLexicalTranslation`.

### Why not the whitelist

The whitelist in `extractLexicalTranslatableProperties` assumes one source
field per node maps to one (string) or many (record) translatable values
written back as `node[property]` or `node[property][key]`. Poll requires:

- Two source fields per node (`question` + `options`).
- `options` is an array of objects, where the translatable text lives at
  `options[i].label` and the stable identity key lives at `options[i].id`.

Extending the whitelist abstraction to cover this shape (a new `valueShape`,
plus restore-side branching that finds the option by id and writes its
`label`) buys nothing over a small parser-level branch and complicates the
util's invariants. Excalidraw already establishes the precedent for
parser-level node-specific extraction when the data shape does not fit the
generic whitelist.

## Edge Cases

- **Empty `question`**: skip — same convention as other whitelist entries.
- **Empty `option.label`**: skip per-item, still process other options.
- **Missing `options` or non-array `options`**: skip the options pass; still
  attempt `question`.
- **Option without a stable `id`**: irrelevant for restore (we mutate the
  object reference, not look it up by id), but the option will still appear
  in the data flow. No special handling.
- **Duplicate `option.label` values**: each produces its own segment with a
  unique `p_N` id, so translations are independent.
- **Poll inside a nested editor state** (e.g. inside `details.content`):
  works automatically because `walkNode` is invoked recursively from
  `scanNestedEditorStates` with a fresh block context.
- **Poll with code-formatted text**: not applicable — `question` and
  `label` are plain strings, not formatted text runs.

## Testing

Add cases to `apps/core/test/src/modules/ai/lexical-translation-parser.spec.ts`:

1. `parseLexicalForTranslation` on an editor state containing a single Poll
   node produces:
   - One property segment for `question`.
   - N property segments for the N non-empty option labels.
   - Zero text segments.
   - Correct `blockId` / `rootIndex` propagation.
2. `restoreLexicalTranslation` round-trip:
   - Given a translations map keyed by the emitted segment ids,
     re-serialise the editor state.
   - Re-parse and assert `question`, every `options[i].label`, and unrelated
     fields (`pollId`, `options[i].id`, `mode`, `closeAt`, `showResults`)
     match expectations.
3. Empty `option.label` is skipped (no segment emitted) but the option
   object remains in the restored state.
4. Poll nested inside a `details` block (nested editor state) is still
   parsed.

No new test file required.

## Risk and Rollout

- **Blast radius:** `lexical-translation-parser.ts` only. No schema, API, or
  database changes. No migration. No effect on non-Poll content.
- **Backward compatibility:** Posts authored before this change continue to
  serialise identically. Existing translations of non-Poll content are
  untouched.
- **Rollout:** Ship in a single PR. No feature flag — translation runs
  asynchronously per post and re-translation is already a supported path,
  so existing posts with Poll nodes will pick up translated `question` /
  `options[].label` on their next translation cycle.

## Out of Scope / Future Work

- If a future node introduces a similar "array of objects with translatable
  string field" shape (e.g. a quiz block), consider lifting Poll's parser
  branch into a small registry that maps `node.type` to a custom extractor.
  Premature for one node type today.
