## TL;DR

Internal maintenance release; no user-facing changes.

## Changes

- Refreshed workspace dependencies to their latest patch/minor releases (NestJS 12.5.1, `@haklex/*` 0.67.0, better-auth 1.7.26, rolldown 1.3.3, vite 8.3.8, `@earendil-works/pi-*` 0.99.2).
- Replaced ESLint with oxlint for repository linting and moved declaration builds/codegen to tsrs.
- Removed the finished `packages/mongo-pg-cli` migration tool from the monorepo; the published `@mx-space/mongo-pg-cli` npm package remains available for v11 → v12 data migrations.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.2.0...v18.2.1
