# Task 1 — Snippet Skill type + service branches

## Scope (in)

- Extend `SnippetType` (TypeScript enum + Zod) with a new value `Skill = 'skill'` in `apps/core/src/modules/snippet/snippet.schema.ts`.
- Extend `SnippetService.validateTypeAndCleanup` (`apps/core/src/modules/snippet/snippet.service.ts`) with a `case SnippetType.Skill` that:
  - Parses YAML frontmatter from `model.raw` using `js-yaml` (already imported in this file as `load`).
  - Requires the frontmatter `name` field to equal `model.name`. Mismatch → throw an `AppException` via `createAppException`.
  - Requires the frontmatter `description` field to be a non-empty string.
  - Sets `model.comment = frontmatter.description` (overwriting any client-supplied value).
  - If `model.customPath` is empty, sets it to `` `sk/${model.name}` ``.
  - Optionally: if `model.reference` is empty or equals the default `'root'`, set it to `'skill'`.
- Extend `SnippetService.attachSnippet` (same file) with `case SnippetType.Skill` that sets `data = model.raw`. Identical to the existing `Text` branch.
- Add focused unit tests in `apps/core/test/src/modules/snippet/snippet.service.spec.ts` (or a new sibling file) covering:
  - Happy path: valid frontmatter — service writes comment, customPath, and accepts.
  - Malformed YAML — throws.
  - Missing frontmatter `name` — throws.
  - `frontmatter.name` ≠ `model.name` — throws.
  - Missing or empty `frontmatter.description` — throws.
  - Extra unknown frontmatter keys preserved in `raw`, no error.
  - `customPath` left explicitly empty → auto-fills to `sk/<name>`.
  - `customPath` set by caller → respected, not overwritten.
  - `comment` field passed by caller is overwritten by frontmatter description.
  - `attachSnippet` on Skill row returns `data = raw`.

## Scope (out)

- No DB SQL migration. `snippets.type` is a `text` column (`packages/db-schema/src/schema/ops.ts:129`), not a pgEnum. Verify this when you read the schema; if you find a pgEnum, STOP and escalate.
- No changes to `snippet-route.controller.ts` (that's Task 2).
- No changes to `PostService` or `PostModule` (that's Task 3).
- No admin UI work (that's Tasks 4–5).
- No `enable`, `method`, `secret` handling for Skill — the existing cleanup at `snippet.service.ts:313` already deletes those for non-Function snippets; Skill falls through that path automatically. Do NOT add a special exemption.

## Exact values (use verbatim)

- Enum value string: `'skill'`
- Default `reference` for Skill: `'skill'`
- Default `customPath` for Skill: `` `sk/${name}` `` (no leading slash)
- The expected `js-yaml` import is already present: `import { load } from 'js-yaml'` at top of `snippet.service.ts`.

## Error codes

The project pattern is one AppErrorCode per failure mode (see existing `SNIPPET_INVALID_JSON`, `SNIPPET_INVALID_JSON5`, `SNIPPET_INVALID_YAML` in `apps/core/src/common/errors/app-error-code.ts`). Add three new codes consistent with that pattern, with sensible English `message` text:

- `SNIPPET_SKILL_INVALID_FRONTMATTER` — parse failed or no frontmatter block found
- `SNIPPET_SKILL_NAME_MISMATCH` — frontmatter `name` ≠ row `name`
- `SNIPPET_SKILL_DESCRIPTION_REQUIRED` — frontmatter `description` missing/empty

Add them to all three places used by other snippet errors:
- `apps/core/src/common/errors/app-error-code.ts`
- `apps/core/src/common/errors/app-error-definitions.ts`
- `apps/core/src/common/errors/app-error-payload.ts`

Set `httpStatus: 400` (matching the existing JSON variants) and a reasonable `message`. No `payload`/`details` needed — `undefined` payload like the existing entries.

## Frontmatter parsing approach

Use a small helper inside `snippet.service.ts` (private method) — keep the implementation simple:

```ts
private parseSkillFrontmatter(raw: string): { name: string; description: string; rest: Record<string, unknown> } {
  // 1. Match the leading `---\n...\n---\n` block (allow CRLF). If absent, throw SNIPPET_SKILL_INVALID_FRONTMATTER.
  // 2. js-yaml `load()` on the frontmatter body. If load throws or result is not a plain object, throw SNIPPET_SKILL_INVALID_FRONTMATTER.
  // 3. Pull `name` (string) and `description` (string). Return as-typed; otherwise let callers throw the right error.
  // 4. Return raw frontmatter rest as a passthrough (not required for v1 logic — callers only care about name + description).
}
```

The exact regex / parsing approach is your call; what matters is the public observable behavior captured in the unit tests above.

## Testing

Follow the project's existing snippet test style. Look at `apps/core/test/src/modules/snippet/snippet.service.spec.ts` for setup conventions (mocks, test container if needed). Prefer pure unit tests where possible — the service methods are mostly synchronous validation logic. Use the project's testcontainer helper only if the existing test file already does.

Run focused tests with:
```bash
pnpm -C apps/core test -- test/src/modules/snippet/snippet.service.spec.ts
```

Before committing, run:
```bash
pnpm -C apps/core run lint -- apps/core/src/modules/snippet apps/core/src/common/errors apps/core/test/src/modules/snippet
```

(Scope checks to changed files only; do NOT run the full repo lint.)

## Commit guidance

One commit on the current branch (`feat/post-skill-attachment`) with a Conventional Commit message:

```
feat(snippet): add Skill type with frontmatter validation

Adds SnippetType.Skill that stores a Claude Code-style markdown skill
bundle (YAML frontmatter + body). The service parses the frontmatter on
create/update, enforces name and description invariants, auto-fills
customPath to sk/<name>, and attachSnippet returns the raw markdown as
data.

No SQL migration needed — snippets.type is a text column.
```

Do NOT include AI co-authorship trailers.

## Out of scope reminders

- No `mxs` / api-client changes in this task.
- No admin UI changes in this task.
- No post integration in this task.
- No new dependencies — `js-yaml` is already imported.
