# Lexical Block Partial Translation Design

## Context

AI translation currently persists article-like translated fields. A translated
row replaces the source `title`, `text`, `content`, `subtitle`, `summary`, and
`tags` with translated values before the frontend receives the response. The
frontend therefore cannot safely repair stale blocks: it no longer has a
structured source-plus-translation pair.

Lexical content already has block-level infrastructure:

| Existing capability | Location | Use in this design |
| --- | --- | --- |
| Root block identifiers | `LexicalService.normalizeBlockIds()` | Stable block identity |
| Root block fingerprints | `LexicalService.extractRootBlocks()` | Block-level freshness comparison |
| Stored source snapshots | `ai_translations.source_block_snapshots` | Previous source block state |
| Stored meta hashes | `ai_translations.source_meta_hashes` | Field-level freshness comparison |
| Incremental translation restore | `restoreLexicalTranslation()` | Missing translations naturally fall back to source text |

The current freshness model still treats the whole article as stale when
`translation.hash !== currentContentHash`. That behavior is correct for
complete translation cache hits, but too coarse for Lexical content whose
unchanged blocks can remain useful.

## Goals

- Return a backend-composed partial translation when only some Lexical blocks
  changed.
- Preserve unchanged translated blocks.
- Fall back changed blocks to the current source text.
- Trigger regeneration for stale translations asynchronously.
- Avoid requiring frontend block-level merge logic.
- Avoid persisting partial translations as canonical translation rows.

## Non-Goals

- Introducing a per-block translation table.
- Replacing the whole-document `hash` field.
- Changing frontend rendering semantics.
- Making non-Lexical formats partially reusable.
- Persisting mixed source-and-translation content as the definitive translation.

## Freshness Model

| Status | Meaning | Response behavior | Background behavior |
| --- | --- | --- | --- |
| `valid` | The stored translation hash matches the current source hash. | Return the stored translation row. | None. |
| `partial` | The full hash is stale, but Lexical block comparison can safely compose a usable result. | Return backend-composed content with stale blocks reverted to source. | Schedule regeneration for the requested language. |
| `stale` | The translation exists but cannot be safely composed. | Use the existing stale/miss behavior. | Schedule regeneration. |
| `missing` | No translation row exists. | Use the existing generation path. | Generate translation. |

`partial` is primarily an internal response classification. The frontend should
not need this status to render content correctly, because the backend response
already contains the final `content` and `text` fields.

## Read Path

```text
┌──────────────────────┐
│ Translation request   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Find existing row     │
└──────────┬───────────┘
           ▼
      ◆ Full hash fresh? ◆
       /              \
      ▼                ▼
┌──────────────┐  ┌────────────────────┐
│ Return row   │  │ Try Lexical partial │
└──────────────┘  └─────────┬──────────┘
                            ▼
                   ◆ Partial possible? ◆
                    /              \
                   ▼                ▼
          ┌────────────────┐  ┌────────────────┐
          │ Return partial  │  │ Existing stale  │
          │ Schedule regen  │  │ Schedule regen  │
          └────────────────┘  └────────────────┘
```

The partial path is available only when all of the following hold:

| Requirement | Rationale |
| --- | --- |
| Current content format is Lexical. | Block snapshots are Lexical-specific. |
| Current source content exists and parses. | The backend must build the result from the latest source structure. |
| Stored translated content exists and parses. | Unchanged blocks are copied from this translated content. |
| Stored source block snapshots exist. | The backend needs a previous source fingerprint map. |
| Current blocks have stable block IDs for reuse. | Blocks without stable identity cannot be safely matched. |

## Partial Composition

The composition unit should be an internal backend helper, for example
`buildPartialLexicalTranslation()`. It receives the current article content and
an existing translation row, then returns either a composed translation-like
object or a failure result.

Composition rules:

| Content region | Fresh | Stale |
| --- | --- | --- |
| Lexical root block | Reuse old translated block text/properties. | Keep the current source block. |
| `title` | Reuse old translated title. | Use current source title. |
| `subtitle` | Reuse old translated subtitle. | Use current source subtitle or `null`. |
| `summary` | Reuse old translated summary. | Use current source summary or `null`. |
| `tags` | Reuse old translated tags. | Use current source tags. |
| `text` | Recompute from composed Lexical `content`. | Recompute from composed Lexical `content`. |

Block reuse must require `blockId + fingerprint` equality. Index alone is not a
safe key because blocks may be reordered.

```text
┌────────────────────┐
│ Current source JSON │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Parse source blocks │
└─────────┬──────────┘
          ▼
┌──────────────────────┐
│ Parse translated JSON │
└─────────┬────────────┘
          ▼
┌────────────────────────────┐
│ For each current block      │
│ compare id + fingerprint    │
└─────────┬──────────────────┘
          ▼
      ◆ Unchanged? ◆
       /          \
      ▼            ▼
┌──────────────┐  ┌──────────────┐
│ Copy old      │  │ Keep source   │
│ translations │  │ block text    │
└──────┬───────┘  └──────┬───────┘
       └──────────┬──────┘
                  ▼
┌────────────────────────────┐
│ restoreLexicalTranslation() │
└─────────┬──────────────────┘
          ▼
┌────────────────────────────┐
│ lexicalToMarkdown(content)  │
└────────────────────────────┘
```

`restoreLexicalTranslation()` already preserves the source text when a segment
or property translation is absent. The partial builder should exploit that
property:

- Populate the translation map only for unchanged blocks.
- Omit stale blocks from the translation map.
- Restore into the current source parse result.
- Recompute Markdown from the restored Lexical JSON.

## Safety Rules

| Rule | Consequence |
| --- | --- |
| A block without `blockId` is treated as stale. | It falls back to source text. |
| A block whose fingerprint differs is treated as stale. | It falls back to source text. |
| A reused block must have compatible segment/property shape. | Incompatible blocks fall back to source text. |
| If source Lexical parsing fails, partial composition fails. | Existing stale behavior applies. |
| If translated Lexical parsing fails, partial composition fails. | Existing stale behavior applies. |
| Mermaid, Excalidraw, poll, ruby, and other property segments must use the existing parser/restorer path. | Special node behavior remains centralized. |
| `text` must be generated from composed `content`. | `content` and `text` remain consistent. |

## Persistence

Partial translations should not be persisted.

| Reason | Explanation |
| --- | --- |
| Avoid canonical mixed-language rows. | The stored translation should remain a complete generated artifact. |
| Preserve existing hash semantics. | `hash` continues to represent the source snapshot used to generate the stored translation. |
| Avoid search-index pollution. | Search should not index a temporary source-plus-translation view as the canonical translation. |
| Keep regeneration straightforward. | The existing incremental generation path can overwrite the stale row with a fresh row. |

The response may carry optional metadata such as `status: "partial"`,
`staleBlockCount`, and `regenerationScheduled`, but persisted translation rows
should remain unchanged until regeneration completes.

## Regeneration

When a partial response is returned, the backend should schedule regeneration
for the requested language asynchronously.

| Scenario | Scheduling behavior |
| --- | --- |
| Full translation is fresh. | Do not schedule. |
| Partial translation is returned. | Schedule stale regeneration for that language. |
| Partial composition fails. | Use existing stale scheduling behavior. |
| A task is already in flight. | Rely on existing task or in-flight deduplication. |
| Scheduling fails. | Log a warning; do not fail the read request. |

The read path must not block on an LLM call. A successful partial response is
valid for immediate display because stale blocks have already fallen back to the
current source.

## Error Handling

| Failure | Behavior |
| --- | --- |
| Source content is missing or invalid. | Skip partial composition. |
| Existing translated content is missing or invalid. | Skip partial composition. |
| Snapshot shape is invalid. | Skip partial composition. |
| Block shape mismatch occurs for a reused candidate. | Treat only that block as stale. |
| Markdown regeneration fails. | Treat partial composition as failed. |
| Regeneration scheduling fails. | Return partial response and log warning. |

## Testing Strategy

Behavior-oriented tests should cover observable outcomes rather than snapshotting
static internal tables.

| Test case | Expected behavior |
| --- | --- |
| One Lexical block changes. | Unchanged blocks remain translated; changed block returns source text. |
| Blocks are reordered. | Reuse follows `blockId + fingerprint`, not root index. |
| A current block lacks `blockId`. | That block returns source text. |
| Existing translated content cannot be parsed. | Partial path is not used. |
| A meta field changes. | Only that field falls back to source; unchanged meta fields remain translated. |
| `text` is returned. | It is generated from the composed `content`. |
| Non-Lexical content is stale. | Existing whole-document stale behavior remains unchanged. |
| Regeneration scheduling fails. | The partial response still succeeds. |

## Acceptance Criteria

- A stale Lexical translation with unchanged blocks can still produce a readable
  backend-composed response.
- Changed blocks are not shown with old translations.
- The frontend can render the returned response without block-level merge logic.
- No partial result is written into `ai_translations`.
- The requested language is scheduled for regeneration after a partial response.
- Existing behavior for fresh, missing, and non-Lexical translations remains
  compatible.
