## TL;DR

mx-core now requires Node.js 26 everywhere — Docker image, CI and published packages — and bundles the latest editor improvements.

## Breaking Changes

- **Runtime**: mx-core requires Node.js 26. The official Docker image ships `node:26-alpine`, CI runs `26.x`, `.nvmrc` is `26`, and the workspace `engines` field declares `>=26.0.0`. **Migration**: deployments using the published `innei/mx-server` image need no action — the image already contains Node.js 26. Bare-metal, custom-image or Railway/nixpacks deployments must upgrade the host or build runtime to Node.js 26 before deploying; Node.js 22 and 24 are no longer supported. Node.js 26 also dropped the bundled corepack, so the image installs corepack from npm and still resolves pnpm from the root `packageManager` field.
- **Published packages**: `@mx-space/api-client`, `@mx-space/cli`, `@mx-space/mongo-pg-cli` and `@mx-space/webhook` now declare `engines.node >= 26.0.0`. Installs with `engine-strict` enabled fail on older Node; the migration CLI also requires Node.js 26 on the host that runs it.

## Highlights

The whole toolchain moved to Node.js 26 in one step: the multi-stage Docker build uses `node:26-alpine` for both the builder and the runtime stage, every GitHub workflow pins `26.x`, and the engine ranges across the monorepo follow. The image build, the production boot path and the V8 compile-cache warmup were verified on Node.js 26; boot timings and the serve path are unchanged.

Node.js 26 no longer ships corepack inside the distribution, so the build stage installs `corepack@0.36.0` from npm before enabling pnpm. pnpm is still resolved from the root `packageManager` field, which keeps a single source of truth for the package-manager version.

The editor pipeline (`@haklex/*`) advanced from 0.48.x to 0.51.x: charts are now first-class Lexical nodes (bar, line, area, pie) with LiteXML output, Excalidraw whiteboards render to SVG without loading the editor, code-block gutters stay sticky on horizontal scroll, and custom nodes keep their block ids and node state through round-trips.

## Changes

### Other

- Editor packages updated to `@haklex/*` 0.51.x — chart nodes with LiteXML support, whiteboard SVG rendering, sticky code-block gutter, block-id retention on custom nodes, and typography/table/code polish ([297bf1f](https://github.com/mx-space/core/commit/297bf1ff9))
- Bundled admin dashboard bumped to 8.4.48

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.16.0...v15.0.0
