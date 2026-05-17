# Virtual Embed Assets — Design

**Date**: 2026-05-16
**Author**: Innei
**Status**: Draft

## Problem

`AssetService` (`apps/core/src/processors/helper/helper.asset.service.ts`) currently reads built-in
templates (email `.ejs`, markdown `.css`, render `.ejs`) from the filesystem at runtime via
`fs.readFile`. The path is `path.resolve(cwd, 'assets')`, populated by a soft-link
`apps/core/assets -> ../../assets` that points to a separately-versioned git repo of mixed
content (text templates + unused PNGs/JPG/zip/shell).

This was a workaround from the TSC era: the legacy build did not bundle non-code files, so the
files had to ship beside the compiled output.

Since the build toolchain moved to **Vite 8 + rolldown** (`build.config.ts`, with `vite-node` for
dev/migrate and Vitest for tests), the bundler can now inline raw file contents as JS string
literals. We should treat the curated set of templates as part of the application bundle rather
than runtime FS artifacts.

## Goals

- Bundle built-in text templates into the production output (`out/*.mjs`) so `mx-core` boots
  without any sibling `assets/` directory.
- Remove the runtime network fallback to
  `https://cdn.jsdelivr.net/gh/mx-space/assets@master/`. The bundle is the source of truth for
  built-in templates.
- Preserve the user-override mechanism (`USER_ASSET_DIR` on the host filesystem). Admins who edit
  email templates from the dashboard, or serverless functions that call `writeAsset`, must
  continue to work without code changes.
- Keep `AssetService`'s public method signatures unchanged so call sites
  (`helper.email.service.ts`, `markdown.service.ts`, `pageproxy.controller.ts`,
  `admin-download.manager.ts`, `serverless.service.ts`) do not need edits.

## Non-Goals

- Migrating user overrides from filesystem to a database table. (Could be a future cloud-native
  cleanup; out of scope here.)
- Touching the external `mx-space/assets` git repo. Its unused binaries (PNG/JPG/`demo-data.zip`)
  and `scripts/update-admin.sh` are not referenced from `apps/core/src/**`; the external repo
  stays alive for any non-core consumers it may have.
- Re-implementing the Monaco type-declaration asset (`assets/types/type.declare.ts`) — it is for
  the admin dashboard's serverless editor and never loaded by core at runtime.

## Inventory

The current `apps/core/assets/` symlink points at files that are actually loaded by core source:

| File | Loaded from |
| --- | --- |
| `email-template/guest.template.ejs` | `helper.email.service.ts` |
| `email-template/owner.template.ejs` | `helper.email.service.ts` |
| `email-template/newsletter.template.ejs` | `helper.email.service.ts` |
| `render/markdown.ejs` | `markdown.service.ts` |
| `render/download-admin.ejs` | `admin-download.manager.ts` |
| `render/local-dev.ejs` | `pageproxy.controller.ts` |
| `markdown/markdown.css` | `markdown.service.ts` |
| `markdown/theme/github.css` | `markdown.service.ts` |
| `markdown/theme/gothic.css` | `markdown.service.ts` |
| `markdown/theme/han.css` | `markdown.service.ts` |
| `markdown/theme/newsprint.css` | `markdown.service.ts` |

Not loaded by any core source (verified via `grep`):

- `276e5ffc-f857-4f29-8f58-e6914d9bbf84.{jpg,png}` and variants
- `demo-data.zip`
- `scripts/update-admin.sh`
- `types/type.declare.ts` (admin-side artifact)

## Design

### File layout

Create a new in-source directory **`apps/core/src/embed/`** and move the eleven text files from
the inventory there:

```
apps/core/src/embed/
  index.ts                           # glob loader + EMBED_FILES map
  email-template/
    guest.template.ejs
    owner.template.ejs
    newsletter.template.ejs
  render/
    markdown.ejs
    download-admin.ejs
    local-dev.ejs
  markdown/
    markdown.css
    theme/
      github.css
      gothic.css
      han.css
      newsprint.css
```

Then delete the symlink **`apps/core/assets`**. The external `mx-space/assets` repo on disk is
left untouched — only the symlink is removed.

### Embed manifest

`apps/core/src/embed/index.ts`:

```ts
// Vite (and vite-node / vitest) inline ?raw imports as strings at build time.
const raw = import.meta.glob('./**/*.{ejs,css}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

// Normalise keys: './email-template/x.ejs' -> '/email-template/x.ejs'
// so call sites can keep passing '/email-template/x.ejs' verbatim.
export const EMBED_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(raw).map(([key, value]) => [key.replace(/^\./, ''), value]),
)
```

The glob runs at module-eval time in all three toolchains:

- `vite-node src/dev.ts` (dev)
- `vitest` (tests)
- `vite build --config build.config.ts` (production bundle)

No custom Vite plugin is required.

### Service refactor

`apps/core/src/processors/helper/helper.asset.service.ts`:

```ts
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { dirname } from 'node:path'

import { Injectable, Logger } from '@nestjs/common'

import { EMBED_FILES } from '~/embed'
import { USER_ASSET_DIR } from '~/constants/path.constant'

export function resolveAssetPath(root: string, assetPath: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(resolvedRoot, assetPath)
  const relativePath = path.relative(resolvedRoot, resolvedPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Asset path escapes root: ${assetPath}`)
  }
  return resolvedPath
}

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name)

  async getAsset(
    assetPath: string,
    options?: Parameters<typeof fs.readFile>[1],
  ): Promise<string | Buffer> {
    // 1. user override on disk takes precedence
    const userPath = resolveAssetPath(USER_ASSET_DIR, assetPath)
    if (existsSync(userPath)) {
      return await fs.readFile(userPath, options)
    }

    // 2. bundled embed
    const key = assetPath.startsWith('/') ? assetPath : `/${assetPath}`
    const text = EMBED_FILES[key]
    if (text !== undefined) {
      const encoding =
        typeof options === 'string' ? options : options?.encoding ?? null
      return encoding ? text : Buffer.from(text, 'utf8')
    }

    throw new Error(`Asset not found: ${assetPath}`)
  }

  async writeUserCustomAsset(
    assetPath: string,
    data: any,
    options: Parameters<typeof fs.writeFile>[2],
  ) {
    const targetPath = resolveAssetPath(USER_ASSET_DIR, assetPath)
    await fs.mkdir(dirname(targetPath), { recursive: true })
    return fs.writeFile(targetPath, data, options)
  }

  removeUserCustomAsset(assetPath: string) {
    return fs.unlink(resolveAssetPath(USER_ASSET_DIR, assetPath))
  }
}
```

Removed: `embedAssetPath` field, `onlineAssetPath`, `checkRoot`, `checkAssetPath`,
`getUserCustomAsset` helper, the `HttpService` constructor dependency, and the network fallback
that wrote files into `embedAssetPath` as a cache.

`helper.module.ts`: drop `HttpService` from `AssetService`'s providers list only if it is no
longer needed elsewhere in that module (it is — `HttpService` is shared, so the module export
stays; just the constructor injection on `AssetService` is removed).

### Behaviour matrix

| Call | User has override at `USER_ASSET_DIR/<path>` | Bundled in `EMBED_FILES` | Result |
| --- | --- | --- | --- |
| `getAsset('/email-template/guest.template.ejs', { encoding: 'utf-8' })` | yes | yes | returns user file contents (string) |
| same | no | yes | returns `EMBED_FILES['/email-template/guest.template.ejs']` (string) |
| `getAsset('/markdown/markdown.css', { encoding: 'utf8' })` | no | yes | returns embedded CSS (string) |
| `getAsset('/some/user-only/path')` | yes | no | returns user file bytes (Buffer) |
| `getAsset('/missing/path')` | no | no | throws `Asset not found: …` |

The third row covers the serverless `readAsset` case where the user-supplied path is arbitrary;
it falls through both layers cleanly.

## Build & deployment

- **`build.config.ts`**: no change. `import.meta.glob` with `eager: true, query: '?raw'` is a
  Vite native feature; rolldown emits the file contents as string literals into the output
  chunks.
- **`vite.config.ts`** (dev): no change.
- **Docker / Dokploy**: the `mx-migrate` and main service no longer need an `assets/` directory
  shipped beside the bundle. If the existing Dockerfile copies `assets/`, that step should be
  removed in a follow-up PR (search the Dockerfile for `assets`); it is harmless to leave for one
  release.
- **Symlink removal**: deleting `apps/core/assets` is a tracked git change. The external repo
  rooted at `/Users/innei/git/innei-repo/mx-core/assets` is independent and is left alone.

## Testing

Add `apps/core/test/src/processors/helper/asset.service.spec.ts` covering:

1. `getAsset` returns embedded content as **string** when `{ encoding: 'utf-8' }` is supplied.
2. `getAsset` returns a **Buffer** when no encoding option is supplied.
3. User override on disk shadows the embedded entry (mock `existsSync` + `fs.readFile`).
4. Throws `Asset not found` for a path that exists in neither layer.

Existing tests that should keep passing without modification:

- email render path in any `email.service` test
- markdown render path in any `markdown.service` test
- `pageproxy` / `admin-download` template injection, if covered

Run scope (per repo convention — only modified files):

```bash
pnpm -C apps/core run test -- src/processors/helper/helper.asset.service
pnpm -C apps/core run test -- src/processors/helper/helper.email.service
pnpm -C apps/core run test -- src/modules/markdown
pnpm -C apps/core lint -- src/processors/helper/helper.asset.service.ts src/embed
pnpm -C apps/core typecheck
```

## Migration steps

1. Create `apps/core/src/embed/` and copy the eleven files from the inventory into it, preserving
   subpaths.
2. Write `apps/core/src/embed/index.ts` exporting `EMBED_FILES`.
3. Refactor `helper.asset.service.ts` per the snippet above. Remove the `HttpService` parameter
   from its constructor.
4. Audit `helper.module.ts` — confirm `AssetService`'s providers list no longer requires
   `HttpService`. Leave `HttpService` exported for other consumers.
5. Delete the `apps/core/assets` symlink (`rm apps/core/assets`).
6. Add the new unit-test spec.
7. Run the scoped lint / typecheck / test commands above.
8. Verify the production bundle: `pnpm -C apps/core run bundle && node out/main.mjs --check`
   should not attempt to read `apps/core/assets/`.

## Risks & rollback

- **Risk**: a runtime caller passes a path that previously fell through to the network fetch and
  silently received fresh CDN content. The new code throws. Mitigation: the inventory above
  enumerates every path actually referenced from source; anything else was already broken when
  the CDN was unreachable.
- **Risk**: a Dockerfile or CI step still expects `apps/core/assets/`. Mitigation: a separate
  cleanup pass on `Dockerfile`, `compose*.yml`, and any deploy scripts after this lands.
- **Rollback**: revert the commit. The symlink and the original `AssetService` are restored.

## Open questions

None at design time. Implementation may surface details around `helper.module.ts`'s `imports`
list — handle inline.
