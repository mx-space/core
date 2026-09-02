# Tag glossary translation + Lexical image caption translation

Issue: mx-space/core#2815 (Linear MXD-242). Two independent gaps in the AI translation subsystem:

1. Post tags are translated per article (`ai_translations.tags`), so the same tag gets different translations across posts, tag pages and the tag cloud stay untranslated, and the frontend links a translated tag name back to a source-name route and breaks.
2. Lexical `image` / `gallery` captions are never translated because the whole node type sits in `LEXICAL_CONTEXT_SKIP_BLOCKS`.

## Part 1 — Tags move into the translation-entry glossary

### Model

- New `TranslationEntryKeyPath`: `post.tag`, `keyType: 'dict'`, `lookupKey = hashSourceText(tag)`, same shape as `note.mood`.
- Add `post.tag` to `validKeyPaths` in `translation-entry.schema.ts` so admin generate/query/update endpoints accept it.
- No DB migration: `translation_entries` already stores arbitrary `keyPath` strings.

### Collection (when entries get generated)

- `AiTranslationEventHandlerService`: subscribe `POST_CREATE`, `POST_UPDATE`, `POST_REPUBLISH`. Payload is `{ id }`; load the post, map `tags[]` to dict values, call `generateForValues`. Gated by `isAutoEntryEnabled()` like notes. `generateForValues` already skips existing entries, so re-saving a post costs zero AI calls for known tags.
- `collectSourceValues()` (admin full regeneration): add distinct tags via the existing `unnest(posts.tags)` query in `post.repository.ts`.
- No new task type and no publish-job coupling. The publish job's `aiResources: ['translation']` stays article-only.

### Per-article translation stops translating tags

- Remove `tags` from the article translation prompt segments. `ArticleContent` hashing keeps `tags` so existing translations are not all marked stale. The `ai_translations.tags` column stays and now receives the source tags; it is never read at serving time. A follow-up contract migration can drop it.
- `helper.translation.service.ts`: drop `'tags'` from `ALL_TRANSLATABLE_FIELDS` and the in-place apply paths so `data.tags` is always the source string array.

### Serving

`data.tags` is never overwritten. Translations ride in a new top-level meta field, a sibling of `translation` / `interaction`:

```ts
GlossaryMetaSchema = z.object({
  tags: z.array(z.object({ source: z.string(), translated: z.string() })).optional(),
}).strict()

BaseResponseMetaSchema += { glossary: GlossaryMetaSchema.optional() }
```

Array of pairs, not a keyed map: source tags are free text, and the response case transform would mangle them as object keys (`MachineLearning` -> `machine_learning`). Pairs need no `@BypassCaseTransform` and no change to the case-transform pipeline. Only tags that have an entry for the requested lang appear; the frontend falls back to the source name.

`MetaObjectBuilder.glossary(value: GlossaryMeta)` sets `meta.glossary`. Works the same for detail responses (`meta.translation` is an object) and list responses (`meta.translation` is a per-id map) because it never touches `translation`.

Producers (all already inject `TranslationEntryService` and take `@Lang()`):

- `post.controller.ts`: list, detail, latest, by-id/slug. Collect the union of `tags` across the returned posts, one `getTranslationsBatch` call with `dictLookups: [{ keyPath: 'post.tag', sourceTexts }]`, emit one shared `meta.glossary.tags` for the whole response.
- `category.controller.ts` `?tag=true` route: same for the returned posts plus the queried tag.
- Category list with `type=tag`, category detail (`tagsSum` + children), and the `?tag=true` route.
- Not wired: `/aggregate` titled items and `/search` (neither renders tags on the frontend today, and search returns a legacy `{ data, pagination }` object without a meta envelope). Add when a consumer needs them.

`buildTagGlossary(entryMaps)` in `helper.translation.service.ts` turns the `post.tag` dict map into pairs; each controller adds `post.tag` to the `getTranslationsBatch` call it already makes.

### Frontend (Yohaku, separate PR)

- `PostMetaBar`, `TagDetailModal`, `posts/tag/[name]` header, mobile taxonomy rows: build a `Map` from `meta.glossary.tags`, display `map.get(tag) ?? tag`, link and fetch with the source `tag`.
- api-client: add optional `glossary` to the base meta type.

### Cache

Dict entries are Redis-cached 7 days per `(keyPath, lang)`; `post.tag` reuses that. Entry update/delete via admin already invalidates.

## Part 2 — Image and gallery caption translation

### Parser change

`image` and `gallery` join `COMPLEX_NODE_EXTRACTORS` in `lexical-translation-parser.ts`, the same registry `poll` uses. The extractor runs before the blacklist skip, so the node still never descends into children, and the whitelist util is untouched.

| nodeType | segments emitted |
| --- | --- |
| `image` | `caption`, `altText` (each a string prop on the node) |
| `gallery` | `images[i].alt` (gallery items carry `alt`, no `caption`) |

Property segments point `node` at the holder object (the image node, or the gallery item), so `restoreLexicalTranslation` writes back with no new branch. Empty strings are skipped. `altText` is included because it is user-visible via screen readers and the `alt` attribute.

### Staleness

Block fingerprints come from `extractBlockText` in `helper.lexical.service.ts`, which only reads known text-bearing fields. Image `caption` / `altText` and gallery `alt` are added there so a caption edit marks the block stale.

### Prompt

`translation-chunk-base.system.md` already handles property segments generically (details summary, ruby reading). Add one line: `image.caption` / `image.altText` / `gallery.alts` segments are short figure captions; translate as captions, keep filenames and product names.

## Testing

- `translation-entry.service.spec`: `post.tag` values dedupe by hash, skip existing, generate for configured langs.
- `ai-translation-event-handler.spec`: POST_CREATE with tags calls `generateForValues` with `post.tag` dict values; disabled flag → no call.
- `post.controller` e2e: `?lang=en` returns `data.tags` unchanged and `meta.glossary.tags` pairs; missing entries omitted; no `lang` -> no `glossary`.
- `lexical-translation-parser.spec`: image with caption+altText yields two property segments and no child segments; gallery yields per-index alt segments; restore round-trips; image inside `SKIP_BLOCKS` still does not emit text segments from children.
- Existing article translation specs updated for `tags` removal from the prompt payload and hash.

## Out of scope

- Making tags first-class entities.
- Dropping `ai_translations.tags` column (contract step, later migration).
- Video / link-card / embed titles.
- Backfilling `post.tag` entries automatically on deploy; the owner runs the existing admin "generate entries" action once.
