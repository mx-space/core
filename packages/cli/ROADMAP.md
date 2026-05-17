# `@mx-space/cli` Roadmap

## Shipped in v0.2

- Multi-environment profile system: named `(api_url, credentials)` bundles under `~/.config/mxs/profiles/<name>/`, `--profile` global flag, `MXS_PROFILE` env var, `mxs profile {ls,show,use,mark,rm}` subcommands, production write gate, and automatic migration from the legacy single-profile layout.

## v2

- AI module commands
  - `mxs ai summary regen <id>`
  - `mxs ai translate <id> --to <locale>`
  - `mxs ai insights refresh`
  - `mxs ai tokens`
- Comment moderation
  - `mxs comment list`
  - `mxs comment approve <id>`
  - `mxs comment reject <id>`
  - `mxs comment delete <id>`
- Markdown → Lexical bridge (contingent on a haklex reader)

## v3

- Maintenance
  - `mxs cache clear [--scope=all|view|post|note|page|aggregate]`
  - `mxs cache stats`
  - `mxs search reindex`
  - `mxs search status`
  - `mxs job list`
  - `mxs job run <name>`
  - `mxs health`
- Backup
  - `mxs backup create [--output <path>]`
  - `mxs backup list`
  - `mxs backup download <id> [--output <path>]`
  - `mxs backup restore <id-or-file> [--force]`
- Export / import (content as files)
  - `mxs export <dir> [--type=post,note,page] [--format=markdown|litexml]`
  - `mxs import <dir> [--type=post] [--update-existing]`
- Observability
  - `mxs logs tail`
  - `mxs metrics`
- OS keychain storage (keytar / libsecret) once monorepo Node version stabilizes
- `mxs init` — bootstrap a fresh mx-core deployment via compose
