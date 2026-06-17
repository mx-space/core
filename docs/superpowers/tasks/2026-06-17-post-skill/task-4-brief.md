# Task 4 — Admin `SnippetEditor` Skill branch

## Scope (in)

Wire the admin client (`apps/admin`) so the new `SnippetType.Skill` is a first-class editable resource. The user picks `Skill` in the type selector and is dropped into a dedicated editor that surfaces the frontmatter and hides the irrelevant Function/JSON fields.

Touch these files:

### 4a. `apps/admin/src/models/snippet.ts`

- Add `Skill = 'skill'` to the `SnippetType` enum, placed AFTER `Text` and BEFORE `Function`.
- Extend `SnippetTypeToLanguage` with `skill = 'markdown'`.

### 4b. `apps/admin/src/features/snippets/constants.ts`

- Add `SnippetType.Skill` to the `snippetTypes` array — placed AFTER `SnippetType.Text` and BEFORE `SnippetType.Function`.

### 4c. `apps/admin/src/features/snippets/utils/snippets.ts`

Add Skill handling to the switch statements:

- `normalizeSnippetRawForSave(type, raw, t)`: case `SnippetType.Skill` returns `raw` unchanged (the server validates the frontmatter; the admin doesn't need to pre-validate before save).
- `getSnippetDefaultsForType(type, prevType, prevRaw, t)`: case `SnippetType.Skill` returns a fresh markdown skeleton:

  ```yaml
  ---
  name: <new-skill>
  description: One-line description shown in skill cards.
  ---
  
  # Skill body
  
  Write the AI-facing instructions here.
  ```

  Use the string `<new-skill>` as a literal placeholder for `name`. When the user later changes the snippet `name` field, the frontmatter stays in sync only if the user edits it — the admin does NOT auto-rewrite the frontmatter for them (server-side validator catches the mismatch, surfaces a toast error).
- `readStructuredSnippetRaw(type, raw, t)`: case `SnippetType.Skill` returns the raw markdown string verbatim (like the Text branch).
- `writeStructuredSnippetRaw(type, value)`: case `SnippetType.Skill` coerces the value to string (like Text).

### 4d. NEW helper `parseSkillFrontmatter` co-located in `apps/admin/src/features/snippets/utils/snippets.ts`

Add a small pure function:

```ts
export function parseSkillFrontmatter(raw: string): {
  ok: true
  name: string | undefined
  description: string | undefined
  unknownKeys: Array<{ key: string; preview: string }>
} | {
  ok: false
  errorMessage: string
}
```

Use the existing `js-yaml` `load` import. The function MUST NOT throw — it returns either an `ok: true` object with whatever it parsed (fields can be `undefined`) OR an `ok: false` with the error message string. The admin's preview pane uses this; the server is authoritative on save.

Implementation:
1. Match the YAML frontmatter block with a regex like `^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n`. If no match, return `{ ok: true, name: undefined, description: undefined, unknownKeys: [] }` — empty preview, no error (the user might still be writing).
2. `load()` the matched YAML body. If `load` throws, return `{ ok: false, errorMessage: e.message }`.
3. If the result is not a plain object, return `{ ok: false, errorMessage: 'frontmatter must be a YAML object' }`.
4. Extract `name` (string or undefined), `description` (string or undefined). Collect all other keys into `unknownKeys` with a one-line preview of each value (`JSON.stringify(value)` truncated to 60 chars).
5. Return `{ ok: true, name, description, unknownKeys }`.

### 4e. `apps/admin/src/features/snippets/components/SnippetEditor.tsx`

Add a Skill branch alongside the existing `isFunction` discriminator:

```ts
const isSkill = form.type === SnippetType.Skill
```

Render layout changes when `isSkill` is true:

- The editor body area splits into TWO panes (only on `desktop:` breakpoint; on smaller screens stack vertically):
  - Left pane (≈ 65% width on desktop): the existing `<CodeEditor>` with `language="markdown"` and `title="SKILL.md"`.
  - Right pane (≈ 35% width on desktop): a new component `<SkillFrontmatterPreview form={form} />` (define inline in this file or as a new sibling file `SkillFrontmatterPreview.tsx` — your call; prefer sibling file).
- Hide the Function action buttons (compiled / logs / install dependency) when `isSkill` (they're already gated on `isFunction`, so no change needed — verify).
- Save button label and disable rules unchanged.

The `<SkillFrontmatterPreview>` component takes `form: CreateSnippetData`, runs `parseSkillFrontmatter(form.raw)` on every render (cheap, no need to memoize for a single markdown string), and displays:

- A "Frontmatter" section header.
- The parsed `name` value with an indicator:
  - If `parseSkillFrontmatter` returned `ok: false`: show the error message in `text-red-600 dark:text-red-400 text-xs` style.
  - If `name` is undefined: show "—" in `text-fg-subtle`.
  - If `name` equals `form.name.trim()`: show a green check icon (lucide `Check`) + the value.
  - Else: show a red X icon (lucide `X`) + the value + a hint line "frontmatter `name` must equal `<form.name>`" in `text-red-600 dark:text-red-400 text-xs`.
- The parsed `description` value (truncated with ellipsis at one line via `truncate` class). If undefined, show "—".
- A bulleted list of `unknownKeys` (if any). Each row: `<key>: <preview>` in `font-mono text-xs text-fg-muted`.

Use the existing Design System v2 tokens (per `apps/admin/CLAUDE.md`):
- Section frame: `rounded-lg border border-border bg-surface-card shadow-sm p-4`.
- Section header: `text-xs font-medium uppercase tracking-wide text-fg-muted`.
- Field labels: `text-xs text-fg-muted`.
- Field values: `text-sm text-fg`.

### 4f. `apps/admin/src/features/snippets/components/SnippetMetaPopover.tsx`

Add an `isSkill` derived flag (computed inside the component the same way `isFunction` is computed at the call site, OR add a new prop `isSkill: boolean` and compute outside — match the existing pattern, which uses props for `isFunction` / `isBuiltInFunction`).

Layout changes when `isSkill` is true:
- HIDE the "Method", "Custom Path", "Enable" / "Method"-related controls in the popover (they're not used for Skill).
- HIDE the "Metatype" field (Skill doesn't use it).
- HIDE the "Secret" field (Skill doesn't use it).
- The "Comment" `TextInput` becomes read-only (`disabled` prop) with a helper line below it: "Auto-populated from frontmatter description on save." Use `text-xs text-fg-muted` for the helper.
- Keep `name`, `type`, `reference` (a.k.a. "group"), `private`, and `comment` (read-only) visible.

The type select MUST allow switching FROM Skill to other types — `typeDisabled` already gates on `Function`; do not add `Skill` to that gate.

### 4g. i18n

Add new keys to `apps/admin/src/i18n/resources/en-US.ts` and `apps/admin/src/i18n/resources/zh-CN.ts`. Follow the existing `snippets.editor.*` key namespace. At minimum:

- `snippets.editor.skill.frontmatter` — "Frontmatter" / "Frontmatter"
- `snippets.editor.skill.name` — "Name" / "名称"
- `snippets.editor.skill.description` — "Description" / "描述"
- `snippets.editor.skill.nameMismatch` — "Frontmatter `name` must equal `{value}`." / "Frontmatter `name` 须与 `{value}` 相等。"
- `snippets.editor.skill.parseError` — "Cannot parse frontmatter" / "无法解析 frontmatter"
- `snippets.editor.skill.commentReadOnly` — "Auto-populated from frontmatter description on save." / "保存时自动填入 frontmatter description。"
- `snippets.editor.skill.unknownKeys` — "Other keys" / "其他键"

The literal `<new-skill>` placeholder in the markdown skeleton is NOT i18n'd — it stays English (it's a programmatic identifier).

## Scope (out)

- No changes to backend (Tasks 1–3 territory).
- No post-write integration (Task 5).
- No new API client / `~/api/snippets` changes — existing `createSnippet` / `updateSnippet` already accept the new type via `SnippetType.Skill`.
- No new test scaffolding for admin components — the admin codebase does not have a React component testing harness for these surfaces. Spec checks are visual + manual; TypeScript is the safety net.

## Exact values

- Markdown skeleton (verbatim, NO i18n):
  ```yaml
  ---
  name: <new-skill>
  description: One-line description shown in skill cards.
  ---
  
  # Skill body
  
  Write the AI-facing instructions here.
  ```
- Frontmatter preview pane width on desktop: ~35% (use `desktop:w-[35%]` or `desktop:basis-[35%]` — match existing flex/grid conventions in the codebase; if there's no clean tailwind class, use `desktop:w-[36%]` to a 64/36 ratio).
- The frontmatter `name` indicator uses `Check` from `lucide-react` for match and `X` for mismatch, both `className="size-4 shrink-0 text-green-600 dark:text-green-400"` (match) or `text-red-600 dark:text-red-400` (mismatch).
- Frontmatter regex (use exactly this; cope with CRLF):
  ```ts
  const FRONTMATTER_REGEX = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/
  ```

## Conventions you MUST follow (apps/admin)

- React 19 + TSX. The repo uses Base UI primitives, NOT a custom UI lib — reuse the existing primitives from `~/ui/...` and existing patterns from `SnippetMetaPopover.tsx`.
- Tailwind v4 via the Design System v2 tokens documented in `apps/admin/CLAUDE.md`. **MUST use** `bg-surface-card`, `bg-surface-inset`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-border`, `rounded-lg`, `shadow-sm`, etc. **MUST NOT use** raw `bg-white` / `text-gray-*` — the rule says `neutral` not `gray` for raw grays, and `surface-*` / `fg-*` for semantic.
- Typography: **MUST** use standard tailwind text classes (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.). **MUST NOT** use arbitrary sizes like `text-[11px]`.
- ZERO comments, ZERO JSDoc. Allowed only for UNEXPECTED behavior. Self-audit before saving.
- camelCase end-to-end.
- Imports: respect the existing import order (lucide-react / external / `~/...`). Match what's already in `SnippetEditor.tsx`.

## TDD / tests

- Add unit tests for `parseSkillFrontmatter` in a new file `apps/admin/src/features/snippets/utils/snippets.skill.test.ts`. Cover:
  - No frontmatter at all → ok=true, all fields undefined
  - Valid frontmatter with name + description → ok=true, both extracted
  - Malformed YAML → ok=false
  - Non-object YAML (`---\nfoo\n---`) → ok=false
  - Extra unknown keys → `unknownKeys` array populated, each entry has truncated preview
  - CRLF line endings → still parses
- Component tests are NOT required (the admin codebase doesn't ship a React testing harness for snippet editor pieces; the existing convention is visual/type-checker).
- Run focused tests:
  ```bash
  pnpm -C apps/admin exec vitest run apps/admin/src/features/snippets/utils/snippets.skill.test.ts
  ```
  If vitest isn't already configured for admin, fall back to `pnpm -C apps/admin run lint && pnpm -C apps/admin run typecheck` and declare "no unit harness for admin — type and lint were the gates."

## Commit guidance

ONE commit on `feat/post-skill-attachment`:

```
feat(admin): add Skill snippet editor with frontmatter preview

Admin can now create and edit SnippetType.Skill rows via a dedicated
two-pane editor: markdown body on the left, live frontmatter preview
on the right showing the parsed name (with mismatch indicator),
description, and any unknown keys. Snippet meta popover hides
method/enable/secret/metatype for Skill rows and makes the comment
field read-only with an auto-population hint.
```

No AI co-authorship trailer.

## Validation before commit

```bash
pnpm -C apps/admin run lint
pnpm -C apps/admin run typecheck
```

If you added a unit test file, also run the focused vitest command. Do NOT run the full backend suite — this task is admin-only.

## Pre-flight notes

- Tasks 1–3 are merged on `feat/post-skill-attachment` (HEAD `9730a624`). The backend already validates frontmatter on save — so even if the admin's preview is wrong, the server rejects the bad save and surfaces a toast via `getErrorMessage`.
- The user CLAUDE.md and `apps/admin/CLAUDE.md` both apply — read both. The strictest rule is "ZERO comments and ZERO JSDoc by default."
- The Skill markdown body starts with `<new-skill>` as a literal — when the user changes `name` in the meta popover, they will need to manually update the frontmatter too (the backend will reject on mismatch with a clear error code). This is intentional MVP behavior; do NOT auto-rewrite the frontmatter.

## When you're in over your head

STOP and escalate (BLOCKED or NEEDS_CONTEXT) when:
- The admin codebase has no markdown CodeEditor mode available and you'd need to wire one (CodeEditor wraps Monaco — markdown should already be supported via `SnippetTypeToLanguage.text = 'markdown'`).
- The Design System v2 tokens called for in the brief don't exist (read `apps/admin/src/styles/tokens.css` to confirm).
- The form state shape from `normalizeSnippet` is incompatible with the new fields and you'd need to change the shared shape.
