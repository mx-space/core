# Snippet VFS Refactor — Universal Path-Keyed Filesystem

**Status:** Draft
**Date:** 2026-06-18
**Author:** Innei (via brainstorming)

## Motivation

The snippet subsystem stores small, addressable resources used across the site: theme partials, serverless functions, JSON/YAML config blobs, free-form text, and — most recently — Claude-style **skills**. Skills are the trigger for this refactor.

Today, each snippet row maps to a single text blob identified by `(reference, name, method)` with an optional `customPath` for URL routing. A skill is one row whose `raw` column holds the SKILL.md content.

The Anthropic skill convention is a **directory of files** — `SKILL.md` at the root, references to siblings (`scripts/gen.py`, `references/notes.md`) by relative path. The current single-row model cannot express this without contortion (bundling sibling files into JSON, adding a `parentId` linkage table, or storing tarballs).

We could solve this narrowly for skills, but the same friction recurs every time we want a multi-file resource: theme bundles with helper scripts, function modules with shared utilities, freeform document trees. The clean solution is to stop treating snippets as a flat key-value table and treat them as a **virtual filesystem (VFS)** instead.

This spec describes a complete redesign of the snippet subsystem along S3 object-key semantics: every row is a file, the path string is the canonical key, directories are virtual (derived from path prefixes at query time), and multi-file resources fall out for free.

## Goals

- One canonical address per snippet: a `path` string, POSIX-style.
- Multi-file skills work end-to-end: schema → backend → admin → mxs CLI → Yohaku consumer.
- Admin renders snippets as a nested file tree (S3-explorer style).
- mxs CLI gains filesystem-style commands (`ls`, `get`, `put`, `rm`, `mv`, `push`, `pull`).
- The skill consumer surface (`PublicSkillView` on post API) keeps its current shape; consumers traverse the bundle by following relative paths in SKILL.md.

## Non-Goals

- Binary file support inside the VFS (images, fonts). Text-only for now.
- Bundles for non-skill types (theme bundles, function modules). The VFS supports them physically, but admin UX and CLI conventions for those are out of scope.
- `reference` column staying around as a derived field. We **delete** it.
- Backward-compatible API shape for the old `{name, reference, customPath}` request/response fields. The cutover is destructive.

## Architecture

### Data Model

The snippet table becomes a flat collection of file rows. Each row has:

- `id` — Snowflake bigint (unchanged)
- `path` — TEXT NOT NULL, the canonical address
- `type` — content contract: `text`, `json`, `json5`, `yaml`, `function`, `skill`
- `raw` — TEXT, the file content
- `method` — HTTP verb, only meaningful for `type=function`
- `private`, `enable`, `secret`, `comment`, `metatype`, `schema`, `builtIn`, `compiledCode`, `createdAt`, `updatedAt` — preserved from current schema

**Deleted columns:** `name`, `reference`, `custom_path`. Their identifying role moves into `path`. Their display role is taken by `path.split('/').at(-1)` for the leaf name.

**Uniqueness:** partial unique indices.

```sql
CREATE UNIQUE INDEX snippets_path_idx
  ON snippets (path) WHERE method IS NULL;
CREATE UNIQUE INDEX snippets_path_method_idx
  ON snippets (path, method) WHERE method IS NOT NULL;
```

Two indices because function snippets can have multiple rows at the same path (different HTTP methods); other types must have a unique path.

**Path constraints (POSIX-style, mostly permissive):**

- Path is a sequence of segments separated by `/`.
- Each segment is 1–255 bytes UTF-8.
- Forbidden segment values: `.`, `..`, empty.
- Forbidden characters in any segment: `/`, `\0`, ASCII control characters (0x00–0x1F, 0x7F).
- Total path length: 1–4096 bytes.
- No leading or trailing `/`.
- No `//` (collapsed empty segment).

Unicode, spaces, and emoji are allowed. The narrow 30-character `^[\w.-]$` constraint from the current `name` column is gone.

### Type Semantics in VFS

`type` no longer describes "where the row lives" or "what subsystem owns it" — that's the path's job. `type` is purely a content contract:

| type | Purpose | Write validation | Runtime behavior |
|---|---|---|---|
| `text` | Any plain text — markdown, scripts, references, freeform | None | Returns `raw` verbatim |
| `json` / `json5` / `yaml` | Structured config | Parse must succeed | Returns `raw` verbatim |
| `function` | Serverless endpoint | TypeScript compile + validate | Executes; returns computed result |
| `skill` | SKILL.md of a skill bundle | Frontmatter parsed; `name` field must match path's penultimate segment; path must end in `/SKILL.md` | Returns `raw`; surfaced to post API via `PublicSkillView` |

A skill bundle's siblings — `sk/foo/scripts/gen.py`, `sk/foo/references/notes.md` — all live as `type=text` rows. The path tells you they belong to the `foo` skill; the type tells you they have no special validation.

Admin's editor infers syntax highlighting from the path's extension (`.py` → Python, `.md` → markdown, `.ts` → TypeScript), not from `type`.

### Routing — Public Consumer Surface

`/s/<path>` is the read-only public endpoint. Path is everything after `/s/`.

Resolution order:

1. Lookup row by `(path, request.method)` (method-aware for function snippets) or by `path` alone (other types).
2. If hit and `type=function`: execute the serverless function and return its result (current behavior preserved).
3. If hit and any other type: return `raw` directly.
4. If no exact match but `<path>/SKILL.md` exists: respond `302 Found` with `Location: /s/<path>/SKILL.md`.
5. Otherwise: `404`.

Rule 4 is the "index file" convention. It keeps existing `/s/sk/foo` URLs working post-migration (they now redirect to `/s/sk/foo/SKILL.md`) and lets future bundles use the same idiom without special casing.

### API — Admin / Management Surface

S3-style listing as the primary read API:

```
GET /api/v3/snippets?prefix=<p>&limit=<n>&recursive=<0|1>
```

Response:

```json
{
  "data": {
    "prefix": "sk/foo/",
    "objects": [
      {
        "id": "...",
        "path": "sk/foo/SKILL.md",
        "type": "skill",
        "comment": "...",
        "updatedAt": "..."
      }
    ],
    "commonPrefixes": ["sk/foo/scripts/", "sk/foo/references/"]
  }
}
```

- `prefix` empty → root listing (top-level common prefixes plus root leaves).
- `recursive=0` (default) → group results by next `/` segment: leaves go to `objects`, deeper groups go to `commonPrefixes`.
- `recursive=1` → flatten: all descendant leaves in `objects`, no `commonPrefixes`.
- Delimiter is hardcoded to `/`; no query param.

Single-object operations are keyed by path:

```
GET    /api/v3/snippets/by-path?path=<p>     # full row including raw
PUT    /api/v3/snippets/by-path?path=<p>     # upsert; body = full snippet input
DELETE /api/v3/snippets/by-path?path=<p>&recursive=<0|1>
POST   /api/v3/snippets/move                 # body: {from, to, recursive}
```

`PUT /by-path` is idempotent upsert. Move accepts both leaves and prefixes (with `recursive=true` for prefix moves, which rewrite every descendant's path inside a transaction).

Other endpoints unchanged in semantics but updated in payload shape:

```
POST           /api/v3/snippets             # create; body uses {path, type, raw, ...}
GET/PATCH/DELETE /api/v3/snippets/:id       # by-id retained for admin ergonomics
```

The `bundle` endpoint proposed in earlier drafts is gone — `?prefix=&recursive=1` plus per-leaf `GET /by-path` covers every bundle operation.

### Skill Consumer Surface

`PublicSkillView` keeps its current public shape:

```ts
type PublicSkillView = {
  id: string
  name: string
  description: string
  rawUrl: string
  raw: string
}
```

`name` is derived from path:

```ts
function deriveSkillName(path: string): string {
  // 'sk/foo/SKILL.md' → 'foo'
  return path.split('/').at(-2) ?? ''
}
```

`rawUrl` points directly at the SKILL.md leaf — `${serverUrl}/s/sk/<name>/SKILL.md`. No redirect, no manifest. Consumers (Claude, Yohaku display) read SKILL.md and follow relative path references in its body to fetch siblings. The skill's self-description IS the directory index — no listing API needed for runtime consumers.

`findSkillsByIds` queries rows by ID, filters to `type=skill` with `path` ending in `/SKILL.md`, and maps each to a `PublicSkillView`.

### Admin UX — VFS Tree Explorer

Layout: left pane is a lazy-loaded tree, right pane is the editor for the currently open leaf.

```
┌─────────────────────────────────────────────────────┐
│ Snippets                                  [+ New]   │
├─────────────┬───────────────────────────────────────┤
│ Tree        │  sk/foo/SKILL.md                      │
│             │  type: skill │ size: 2.3KB │ private  │
│ ▼ sk/       │  ───────────────────────────────────  │
│   ▼ foo/    │  ┌─────────────────────────────────┐  │
│     SKILL.md│  │ ---                             │  │
│     ▼ scripts/ │ name: foo                       │  │
│       gen.py│  │ description: ...                │  │
│   ▶ bar/    │  │ ---                             │  │
│ ▶ theme/    │  │                                 │  │
│ ▶ fn/       │  │ # Skill body                    │  │
│ ▶ root/     │  └─────────────────────────────────┘  │
│             │  [Save]  [Move]  [Delete]             │
└─────────────┴───────────────────────────────────────┘
```

**Tree pane:**

- Root fetch: `GET /snippets?prefix=&recursive=0`. Top-level shows `sk/`, `theme/`, `fn/`, `root/` etc. as common prefixes, plus any orphan leaves at the root.
- Lazy expansion: when user expands a folder, fetch `?prefix=<full-prefix>&recursive=0`.
- Each node: folder (common prefix) shows ▶/▼ + dir icon; leaf shows file icon + leaf name + small `type` chip.
- Drag-drop a leaf onto a folder → `POST /snippets/move`.
- Context menu: Rename, Duplicate, Move…, Delete.

**Editor pane:**

- Route: `/dashboard/snippets/<path>` reflects the open leaf; `/dashboard/snippets` is empty state.
- Top metadata strip: path, type, size, private flag, updatedAt.
- Editor: CodeMirror (admin already uses it). Syntax highlighting derived from path extension.
- Per-type side panel (only shown when the type carries extra fields):
  - `function`: HTTP method selector, secret editor, metatype, schema
  - `skill`: frontmatter validation errors (live, inline)
  - others: no side panel

**+ New modal:**

- Inputs: `path`, `type` (auto-suggested from extension), empty `raw`.
- Path validation runs client-side (POSIX rules) with a server pre-check (`GET /by-path` returning 404 means free).
- Submit → `PUT /by-path`.

**Folder operations:**

- "Rename folder" → `POST /snippets/move` with `{from: 'sk/foo/', to: 'sk/bar/', recursive: true}`. The backend rewrites every descendant's path inside a transaction.
- "Delete folder" → `DELETE /by-path?path=sk/foo/&recursive=true`.
- "New folder" has no underlying operation — it's purely UI staging. User types a folder name, then immediately creates the first leaf inside it; the folder materializes once that leaf is saved.

**No skill specialization in the UX.** A skill is just a leaf at `sk/<x>/SKILL.md` with `type=skill`. There is no "skill wizard", no special folder icon. The only convenience: when the user creates a new file with `type=skill`, the editor pre-fills a placeholder frontmatter so they don't start from blank.

### mxs CLI — Filesystem-Style Commands

Path-based snippet subcommands replace the current `name`-based ones:

```bash
mxs snippet ls [prefix]              # list; no arg → root
mxs snippet ls sk/foo/ --recursive   # flatten the bundle
mxs snippet get <path> [-o file]     # fetch raw to stdout or file
mxs snippet put <path> [file|-]      # write/upsert; - reads stdin
mxs snippet rm <path> [--recursive]  # delete leaf or prefix
mxs snippet mv <from> <to>           # rename/move; works on prefixes too
mxs snippet edit <path>              # open $EDITOR on temp; save syncs back
```

Directory sync is the marquee new capability:

```bash
mxs snippet push <local-dir> <remote-prefix>
mxs snippet pull <remote-prefix> <local-dir>
```

`push` walks `<local-dir>` recursively, skipping built-in ignore patterns (`.git/`, `node_modules/`, `__pycache__/`, `.DS_Store`, plus any `--ignore=<glob>` patterns). For each file:

- Compute remote path: `<remote-prefix>/<relative>`
- Auto-detect type from path:
  - `SKILL.md` whose content starts with `---\n` → `skill`
  - `*.json` → `json`
  - `*.yaml`/`*.yml` → `yaml`
  - `*.json5` → `json5`
  - everything else → `text`
- `PUT /snippets/by-path`

Flags:

- `--dry-run` — preview without sending requests.
- `--delete` — delete remote files not present locally (S3-style sync semantics). Default is additive.
- `--type=<t>` — force type for all files in this push.

`pull` is the inverse: list `?prefix=<remote-prefix>&recursive=1`, GET each leaf, write to `<local-dir>/<relative>`. Same `--delete` semantics for local pruning.

A multi-file skill is now pushed with no skill-specific command:

```bash
mxs snippet push ./my-skill sk/my-skill/
```

The `SKILL.md` becomes `type=skill`; sibling files become `type=text`.

**Legacy `mxs skill` subcommands:**

- `mxs skill ls/get/search/all` — kept as thin aliases that prepend `sk/` and delegate to `mxs snippet`. No independent implementation.
- `mxs skill push` (the old `push-skill.sh` shell script) — deleted. Users move to `mxs snippet push`.

Output format unchanged: human-friendly tables by default, `--json` for machine output. Profile/endpoint resolution unchanged.

## Migration

Personal-blog scale + single operator means a short maintenance window is acceptable. The migration collapses to one atomic SQL transaction plus one code deploy.

### Procedure

1. Dokploy: scale `mx-core` to 0 replicas (admin is served from core, so it goes down too).
2. Run the migration: a single SQL file, transaction-wrapped.
3. Deploy the new code release (backend + admin + mxs published together; Yohaku release picks up the new `rawUrl` shape on its next build, but consumes through `rawUrl` so changes are invisible to it).
4. Scale `mx-core` back to 2 replicas.

Expected downtime: 5–10 minutes (migration runs in seconds; the rest is image pull + health checks).

### Migration SQL

```sql
BEGIN;

ALTER TABLE snippets ADD COLUMN path TEXT;

UPDATE snippets SET path = CASE
  WHEN reference = 'skill'     THEN 'sk/' || name || '/SKILL.md'
  WHEN custom_path IS NOT NULL THEN custom_path
  WHEN reference = 'theme'     THEN 'theme/' || name
  WHEN reference = 'root'      THEN 'root/' || name
  ELSE reference || '/' || name
END;

-- Pre-flight: abort if backfill produced any path collisions
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT path, method FROM snippets GROUP BY path, method HAVING count(*) > 1
  ) s;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'path collision detected: % duplicate keys', dup_count;
  END IF;
END $$;

ALTER TABLE snippets ALTER COLUMN path SET NOT NULL;

CREATE UNIQUE INDEX snippets_path_idx
  ON snippets (path) WHERE method IS NULL;
CREATE UNIQUE INDEX snippets_path_method_idx
  ON snippets (path, method) WHERE method IS NOT NULL;

ALTER TABLE snippets DROP COLUMN reference;
ALTER TABLE snippets DROP COLUMN name;
ALTER TABLE snippets DROP COLUMN custom_path;

COMMIT;
```

After the SQL commits, flush Redis snippet cache keys:

```
redis-cli --scan --pattern 'snippet:*' | xargs redis-cli del
```

### Rollback

Take a PostgreSQL volume snapshot before scaling down. If the new release has a critical defect:

1. Stop the app.
2. Restore the snapshot.
3. Deploy the previous release.
4. Start the app.

We do not write a reverse migration — the snapshot is the rollback mechanism.

### Test Matrix

- **Migration test:** fixture rows covering all six reference types; run the migration; assert `path` filled, unique indices enforced, old columns gone.
- **Collision test:** construct rows that would collide on `path` after backfill (e.g., `(reference='theme', name='foo')` plus an explicit `custom_path='theme/foo'`); run the migration; assert `RAISE EXCEPTION` triggers and the transaction rolls back.
- **E2E (snippet, post, skill):** existing specs rewritten for path-based addressing. Old specs deleted.
- **Route compat:** `GET /s/sk/foo` → 302 → `/s/sk/foo/SKILL.md`; `GET /s/sk/foo/SKILL.md` → 200; `GET /s/sk/foo/scripts/gen.py` → 200.
- **mxs push/pull round-trip:** push a local directory, pull it back, assert byte-equal contents.

## File Impact

- `apps/core/src/database/schema/snippets.ts` — schema definition (drop columns, add path).
- `apps/core/src/database/migrations/<N>_snippet_vfs.sql` — single migration file.
- `apps/core/src/modules/snippet/` — repository, service, controller, route controller, schema, types, views (full rewrite of internal addressing).
- `apps/core/src/modules/post/post.service.ts` — adjust the `findSkillsByIds` call site if signature changes.
- `apps/admin/src/pages/snippet/*` — replace the flat list UI with the tree explorer + editor.
- `packages/cli/src/cli/snippet/*` — replace with path-based commands.
- `packages/cli/src/cli/skill/*` — collapse to thin aliases over `mxs snippet`.
- `packages/api-client/...` — regenerate type defs for the new request/response shapes.
- E2E test specs covering snippet, post-skill attachment, and route compat — full rewrite.

## Open Questions

None blocking. Items intentionally deferred:

- Binary files in the VFS — future spec.
- Non-skill bundles (theme bundles, function modules) — physically supported now, idiomatic UX deferred.
- Per-folder access control (e.g., make `sk/foo/` private without touching `sk/foo/SKILL.md`) — current per-row `private` flag is preserved; folder-level inheritance is a future concern.
