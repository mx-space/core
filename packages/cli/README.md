# @mx-space/cli (`mxs`)

> **v0.3.0 — Effect-TS rewrite.** The CLI has been re-implemented on top of [`@effect/cli`](https://effect.website) and the Effect platform. The user-facing surface — subcommands, flags, output modes, exit codes, JSON envelope shape — is preserved per the [design spec](../../docs/superpowers/specs/2026-05-18-cli-effect-ts-rewrite-design.md). If you depended on the JavaScript API surface (`import { … } from '@mx-space/cli'`), that surface is intentionally minimal in v0.3 — check the current exports in [`src/index.ts`](./src/index.ts).
>
> Architecture, conventions, and extension points are documented in [`docs/architecture.md`](./docs/architecture.md).

Command-line interface for managing a deployed mx-core instance. The CLI is designed for single-owner blog operations, script automation, and AI agents that need stable read/write contracts.

## Installation

| Method | Command                        |
| ------ | ------------------------------ |
| pnpm   | `pnpm add -g @mx-space/cli`    |
| npm    | `npm install -g @mx-space/cli` |

Node.js 22 or newer is required.

## Quick Start

```bash
mxs auth login
mxs post create --file ./post.xml --open --silent     # open admin preview, terse output
mxs post get my-slug --output xml > /tmp/post.xml     # round-trip envelope
# edit /tmp/post.xml ...
mxs post update my-slug --file /tmp/post.xml --open
mxs post publish my-slug
```

When the CLI cannot resolve an API URL, it starts an interactive onboarding prompt in TTY contexts. Use `MXS_API_URL` or `--api-url` for non-interactive environments.

## Global Flags

| Flag               | Effect                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| `--json`           | Emit `{ ok: true, data }` on stdout. Takes precedence over `--output`.        |
| `--output <mode>`  | Output mode. Supported: `pretty-json`, `json`, `readable`, `llm`, `xml`. |
| `--api-url <url>`  | Override the configured mx-core API origin.                                   |
| `--token <token>`  | Override the stored access token.                                             |
| `--api-key <key>`  | Authenticate with an API key through the `x-api-key` header.                  |
| `--lang <code>`    | Request translated data for read commands, such as `ja` or `en`.              |
| `--quiet`, `-q`    | Suppress non-error stderr messages.                                           |
| `--verbose`        | Print HTTP method, URL, status, and duration to stderr.                       |
| `--dry-run`        | Resolve payloads without mutating the server where supported.                 |
| `--profile <name>` | Profile to use (overrides `MXS_PROFILE` and the active pointer).              |

`readable`, `llm`, and `xml` are document output modes for `post get`, `note get`, and `page get`. `post list` additionally supports `readable` and `llm` for concise list summaries. Other commands keep their existing JSON-oriented output.

## Output Modes

| Mode          | Shape                                            | Primary Use                                   |
| ------------- | ------------------------------------------------ | --------------------------------------------- |
| `pretty-json` | Raw response payload formatted with indentation. | Human inspection and existing behavior.       |
| `json`        | `{ ok: true, data }` JSON envelope.              | Scripts and structured automation.            |
| `readable`    | Compact key-value metadata plus readable body.   | Human terminal reading.                       |
| `llm`         | Same stable readable structure as `readable`.    | AI-agent context with lower structural noise. |
| `xml`         | `<mxpost>` or `<mxnote>` LiteXML envelope.       | Editable document round trips.                |

For Lexical documents, `readable`, `llm`, and `xml` render the body as LiteXML through `@haklex/rich-litexml` instead of exposing Lexical JSON.

Example:

```bash
mxs post get my-slug --output llm
mxs --lang ja post list --output llm
```

```text
post
id: 123
title: Example
slug: example
state: published
category: Tech
tags: cli, ai

summary:
Short summary.

content_format: litexml

content:
<p>Hello world.</p>
```

## Authentication

| Command           | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `mxs auth login`  | Start the OIDC device authorization flow and store credentials.         |
| `mxs auth logout` | Delete stored credentials.                                              |
| `mxs auth whoami` | Show the server-validated authenticated user and resolved API URL.      |
| `mxs auth status` | Show token presence, expiry, refresh-token availability, and user data. |

`auth login` prints the verification URL and user code. In non-JSON interactive mode, it attempts to open the complete verification URL in the browser.

The CLI refreshes credentials in two ways. If a stored OAuth `refresh_token`
exists, it uses the refresh-token grant. Device authorization normally stores a
Better Auth session token instead; for that path the CLI calls Better Auth
`/get-session`, accepts the refreshed `set-auth-token` header, and updates the
local expiry from the refreshed session.

### Auth and profiles

`mxs auth login [--profile <name>] [--production]` writes credentials to the named profile. If `--profile` is omitted and a current profile is active, it refreshes that profile. If no current profile exists (fresh install), it creates and selects the `default` profile. If the `current` pointer references a profile whose directory has been removed, `auth login` recovers by creating the requested profile (or recreating the pointed-at one) rather than failing with `profile.not_found`. Passing `--production` sets the production flag on the target profile after login succeeds.

`mxs auth logout [--profile <name>]` clears credentials for the target profile; the profile directory and the `current` pointer are preserved.

`mxs auth whoami` and `mxs auth status` scope to the active profile as resolved by the standard chain (see §Profiles below).

## Profiles

A profile is a named bundle of `(api_url, credentials)` stored under `~/.config/mxs/profiles/<name>/`. Switching profile switches both the URL and the credentials atomically, so a production token can never accidentally reach a development backend and vice versa.

### Active profile

The file `~/.config/mxs/current` contains the name of the default profile. This is the profile used when no override is present. You can override it per-invocation with `--profile <name>` or by setting `MXS_PROFILE=<name>` in the environment. The full resolution chain is: `--profile` flag → `MXS_PROFILE` env → `current` file. If none of these resolves to a valid profile and the command is not `profile`, `auth login --profile <name>`, or `--help`, the CLI exits with a `profile.none_active` error.

### Profile commands

| Command | Description |
| --- | --- |
| `mxs profile ls` | List profiles; current is marked with `*`; shows the production flag. |
| `mxs profile show [<name>]` | Show api_url, authenticated user, production flag, and token expiry for the named profile (or the active one). Never prints the token. |
| `mxs profile use <name>` | Set the active profile by writing `<name>` to `~/.config/mxs/current`. |
| `mxs profile mark <name> --production` / `--no-production` | Toggle the production flag on a profile. |
| `mxs profile rm <name>` | Delete a profile directory. Prompts for confirmation in TTY contexts; requires `--force` in non-TTY. |

### Production-profile safety

When a profile has `production: true`, the CLI prevents silent writes that occur only because the profile was inherited through the `current` pointer. A write command (`POST`, `PUT`, `PATCH`, `DELETE`) is blocked when: (1) the resolved profile is marked production, (2) the profile was selected only via the `current` file — not via `--profile` or `MXS_PROFILE`, and (3) the URL was not overridden with `--api-url` or `MXS_API_URL`. In that case the CLI refuses the request and emits:

```json
{ "ok": false, "error": "profile.write_requires_explicit",
  "profile": "prod", "api_url": "https://blog.example.com",
  "hint": "active profile 'prod' is production; retry with --profile prod or MXS_PROFILE=prod" }
```

Exit code is `4`. To proceed, supply an explicit signal of intent:

```bash
# Any of these bypasses the gate:
mxs --profile prod post publish my-slug
MXS_PROFILE=prod mxs post publish my-slug
mxs --api-url https://blog.example.com post publish my-slug
```

Running `mxs profile use prod` and then issuing a write is **not** sufficient — the gate measures per-invocation explicitness, not session state.

`mxs auth login` and `mxs auth logout` are exempt from the gate; they are not content writes.

### Active-profile banner

When the resolved profile is marked `production: true`, the CLI emits a single line to stderr before executing the command:

```
mxs: profile=prod (production) → https://blog.example.com
```

This banner is suppressed by `--quiet` / `-q` and never appears on stdout.

### Profile name rules

Profile names must match `^[a-z0-9_-]+$` and be 1–32 characters long. The name `current` is reserved and cannot be used.

### Migration from the single-profile layout

Existing installations that use the legacy flat files (`~/.config/mxs/config.json` and `~/.config/mxs/credentials.json`) are automatically migrated on the first run of the new CLI version. The legacy files are moved into `~/.config/mxs/profiles/default/` and `default` is written to `~/.config/mxs/current`. In TTY contexts, the CLI prompts once: `Is "<api_url>" a production environment? [y/N]` — answering yes sets `production: true` on the migrated profile. Non-TTY contexts skip the prompt and leave the flag unset. Migration runs at most once; subsequent invocations skip the check.

## Posts

| Command                         | Description                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `mxs post list`                 | List posts.                                                                                             |
| `mxs post get <slugOrId>`       | Read a post by Snowflake id or slug.                                                                    |
| `mxs post create`               | Create a post.                                                                                          |
| `mxs post edit <slugOrId>`      | Edit a post through `$EDITOR` when no content flags are supplied; otherwise replace through flags/file. |
| `mxs post update <slugOrId>`    | Patch selected post fields. Content is left unchanged unless `--content` or `--file` is supplied.       |
| `mxs post delete <slugOrId>`    | Delete a post. Requires `--force` in non-TTY contexts.                                                  |
| `mxs post publish <slugOrId>`   | Set `isPublished=true`.                                                                                 |
| `mxs post unpublish <slugOrId>` | Set `isPublished=false`.                                                                                |

### Post List Flags

| Flag              | Effect                                                          |
| ----------------- | --------------------------------------------------------------- |
| `--page <n>`      | Page number.                                                    |
| `--size <n>`      | Page size.                                                      |
| `--state <state>` | Publication filter, such as `draft` or `publish`.               |
| `--sort <field>`  | Sort field passed as `sortBy`, such as `created` or `modified`. |

`mxs post list --output llm` emits one compact metadata block per post and omits full article bodies.

### Post Write Flags

| Flag                      | Field                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| `--title <text>`          | `title`                                                                |
| `--slug <slug>`           | `slug`                                                                 |
| `--category <id-or-name>` | Resolved to `categoryId` by id, slug, or name.                         |
| `--content <spec>`        | Body source. See content spec grammar below.                           |
| `--format <format>`       | `contentFormat`; supported: `lexical`, `markdown`. Default: `lexical`. |
| `--summary <text>`        | `summary`                                                              |
| `--state <state>`         | `publish` or `draft`; maps to `isPublished`.                           |
| `--tags <csv>`            | Comma-separated tags.                                                  |
| `--copyright <bool>`      | `copyright`; accepts `true` or `false`.                                |
| `--pin <iso>`             | Pin timestamp/date.                                                    |
| `--pin-order <n>`         | Numeric pin order.                                                     |
| `--related <csv>`         | Comma-separated related document ids.                                  |
| `--meta <spec>`           | JSON literal or `file=<path>`.                                         |
| `--file <path>`           | LiteXML envelope.                                                      |
| `--open`                  | After success, open the admin edit page in the default browser.        |
| `--silent`                | On success, emit `ok` instead of the full server response.             |

`--open` and `--silent` are also available on `post update`, `post edit`,
`note create`/`update`, and `page create`/`update`. The admin URL is
resolved from the server's `/options/url.admin_url` config; the opened
URL follows the admin-vue3 hash-router convention
(`${admin_url}#/<kind>/edit?id=<id>`).

## Notes

| Command                         | Description                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `mxs note list`                 | List notes.                                                                                             |
| `mxs note get <slugOrId>`       | Read a note by Snowflake id, numeric nid, or direct identifier.                                         |
| `mxs note create`               | Create a note.                                                                                          |
| `mxs note edit <slugOrId>`      | Edit a note through `$EDITOR` when no content flags are supplied; otherwise replace through flags/file. |
| `mxs note update <slugOrId>`    | Patch selected note fields. Content is left unchanged unless `--content` or `--file` is supplied.       |
| `mxs note delete <slugOrId>`    | Delete a note. Requires `--force` in non-TTY contexts.                                                  |
| `mxs note publish <slugOrId>`   | Set `isPublished=true`.                                                                                 |
| `mxs note unpublish <slugOrId>` | Set `isPublished=false`.                                                                                |

### Note List Flags

| Flag              | Effect                         |
| ----------------- | ------------------------------ |
| `--page <n>`      | Page number.                   |
| `--size <n>`      | Page size.                     |
| `--state <state>` | Publication filter.            |
| `--sort <field>`  | Sort field passed as `sortBy`. |

`mxs note list --output llm` emits one compact metadata block per note and omits full note bodies.

### Note Write Flags

| Flag                   | Field                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `--title <text>`       | `title`; defaults to `无题` ("Untitled") for create payloads.          |
| `--slug <slug>`        | `slug`                                                                 |
| `--topic <id-or-name>` | Resolved to `topicId` by id, slug, or name.                            |
| `--content <spec>`     | Body source.                                                           |
| `--format <format>`    | `contentFormat`; supported: `lexical`, `markdown`. Default: `lexical`. |
| `--state <state>`      | `publish` or `draft`; maps to `isPublished`.                           |
| `--mood <text>`        | `mood`                                                                 |
| `--weather <text>`     | `weather`                                                              |
| `--public-at <iso>`    | `publicAt`                                                             |
| `--password <text>`    | `password`                                                             |
| `--bookmark <bool>`    | `bookmark`; accepts `true` or `false`.                                 |
| `--coords <lat,lng>`   | `coordinates`                                                          |
| `--location <text>`    | `location`                                                             |
| `--images <spec>`      | JSON literal or `file=<path>`.                                         |
| `--meta <spec>`        | JSON literal or `file=<path>`.                                         |
| `--file <path>`        | LiteXML envelope.                                                      |

## Pages

| Command                      | Description                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `mxs page list`              | List pages.                                                                                             |
| `mxs page get <slugOrId>`    | Read a page by Snowflake id or slug.                                                                    |
| `mxs page create`            | Create a page.                                                                                          |
| `mxs page edit <slugOrId>`   | Edit a page through `$EDITOR` when no content flags are supplied; otherwise replace through flags/file. |
| `mxs page update <slugOrId>` | Patch selected page fields. Content is left unchanged unless `--content` or `--file` is supplied.       |
| `mxs page delete <slugOrId>` | Delete a page. Requires `--force` in non-TTY contexts.                                                  |

### Page Write Flags

| Flag                | Field                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `--title <text>`    | `title`                                                                |
| `--slug <slug>`     | `slug`                                                                 |
| `--subtitle <text>` | `subtitle`                                                             |
| `--order <n>`       | Numeric page order.                                                    |
| `--content <spec>`  | Body source.                                                           |
| `--format <format>` | `contentFormat`; supported: `lexical`, `markdown`. Default: `lexical`. |
| `--meta <spec>`     | JSON literal or `file=<path>`.                                         |
| `--file <path>`     | LiteXML envelope.                                                      |

Page edit and page file payloads currently reuse the `<mxpost>` envelope shape.

## Projects

| Command                          | Description                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `mxs project list`               | List projects.                                                                                             |
| `mxs project get <nameOrId>`     | Read a project by Snowflake id or unique `name` (raw envelope).                                            |
| `mxs project view <nameOrId>`    | Show a project rendered for terminal / LLM consumption.                                                    |
| `mxs project create`             | Create a project. `--name` and `--description` are required.                                               |
| `mxs project edit <nameOrId>`    | Edit through `$EDITOR` using a JSON envelope of editable fields. No change → no PATCH; malformed JSON exits with `validation.json`. |
| `mxs project update <nameOrId>`  | Patch selected project fields. Missing flags leave the field untouched.                                    |
| `mxs project delete <nameOrId>`  | Delete a project. Requires `--force` in non-TTY contexts.                                                  |

### Project Write Flags

| Flag                   | Field           | Notes                                          |
| ---------------------- | --------------- | ---------------------------------------------- |
| `--name <text>`        | `name`          | Required on `create`. Unique server-side.       |
| `--description <text>` | `description`   | Required on `create`.                          |
| `--preview-url <url>`  | `previewUrl`    | http(s) URL.                                   |
| `--project-url <url>`  | `projectUrl`    | http(s) URL.                                   |
| `--doc-url <url>`      | `docUrl`        | http(s) URL.                                   |
| `--avatar <url>`       | `avatar`        | http(s) URL.                                   |
| `--images <csv>`       | `images`        | Comma-separated list of URLs (≤ 20).            |
| `--text <text>`        | `text`          | Free-form plain text.                          |
| `--file <path>`        | (merge)         | JSON file whose recognised keys merge in first; per-flag values override. |
| `--open`               | —               | After success, open the admin edit page.       |
| `--silent`             | —               | On success, emit `{ ok: true }` instead of the full row. |

Resolver: `<nameOrId>` accepts a Snowflake id directly, or a `name` resolved via `GET /projects/all`. Duplicate names surface from the server as `PROJECT_NAME_TAKEN` (409).

## Categories

| Command                                           | Description                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `mxs category list`                               | List categories and tags.                                         |
| `mxs category get <slugOrId>`                     | Read a category or tag.                                           |
| `mxs category create --name <name> --slug <slug>` | Create a category or tag.                                         |
| `mxs category update <slugOrId>`                  | Patch category or tag fields.                                     |
| `mxs category delete <slugOrId>`                  | Delete a category or tag. Requires `--force` in non-TTY contexts. |

### Category Write Flags

| Flag            | Field                                                |
| --------------- | ---------------------------------------------------- |
| `--name <text>` | `name`                                               |
| `--slug <slug>` | `slug`                                               |
| `--type <type>` | `category` or `tag`; maps to server type `0` or `1`. |
| `--icon <text>` | `icon`                                               |

## Topics

| Command                                        | Description                                             |
| ---------------------------------------------- | ------------------------------------------------------- |
| `mxs topic list`                               | List all topics.                                        |
| `mxs topic get <slugOrId>`                     | Read a topic by Snowflake id or slug.                   |
| `mxs topic create --name <name> --slug <slug>` | Create a topic.                                         |
| `mxs topic update <slugOrId>`                  | Patch topic fields.                                     |
| `mxs topic delete <slugOrId>`                  | Delete a topic. Requires `--force` in non-TTY contexts. |

### Topic Write Flags

| Flag                   | Field         |
| ---------------------- | ------------- |
| `--name <text>`        | `name`        |
| `--slug <slug>`        | `slug`        |
| `--description <text>` | `description` |
| `--icon <text>`        | `icon`        |

## Comments

Moderation commands for the comment queue. `state` is one of `unread`, `read`, or `junk` (server-side codes `0`, `1`, `2`).

| Command                                | Description                                                       |
| -------------------------------------- | ----------------------------------------------------------------- |
| `mxs comment list`                     | List comments (default `--state unread`).                         |
| `mxs comment unread`                   | Shortcut for `comment list --state unread` (accepts `--page` / `--size`). |
| `mxs comment get <id>`                 | Show a single comment by id.                                      |
| `mxs comment reply <id> --text <s>`    | Post an owner reply to a comment.                                 |
| `mxs comment approve <id...>`          | Mark one or more comments as read (state→1).                      |
| `mxs comment reject <id...>`           | Mark one or more comments as junk (state→2).                      |
| `mxs comment delete <id...>`           | Soft-delete one or more comments.                                 |

### Comment Reply Flags

| Flag           | Description                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| `--text <s>`   | Reply text. Accepts inline literal, `file=<path>`, or `-` / `stdin` to read from stdin.     |
| `--whispers`   | Mark this reply as whispers (owner-only visible).                                           |
| `--silent`     | On success, emit a minimal `{ ok: true }` instead of the full server response.              |

Examples:

```bash
mxs comment reply 141088044533944320 --text "thanks for reading"
mxs comment reply 141088044533944320 --text file=reply.md --silent
echo "stdin body" | mxs comment reply 141088044533944320 --text -
```

### Comment List Flags

| Flag                          | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `--page <n>` / `--size <n>`   | Standard paging knobs.                                                     |
| `--state <unread|read|junk>`  | Filter by state. Defaults to `unread`.                                     |
| `--all`                       | Aggregate every state into one response (issues three parallel requests).  |

### Comment Moderation Flags

| Flag                          | Applies to              | Description                                                                |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| `--all`                       | approve, reject, delete | Apply to every comment instead of the explicit `<id...>` list.             |
| `--state <unread|read|junk>`  | approve, reject, delete | When used with `--all`, restricts the affected set by current state.       |
| `--force`                     | delete, any `--all`     | Required in non-TTY contexts to confirm destructive operations.            |

Guard summary:

- `delete` of a single id refuses to run in a non-TTY context without `--force`.
- Any `--all` invocation (`approve`, `reject`, `delete`) refuses to run in a non-TTY context without `--force`.
- `approve` and `reject` of explicit ids run without confirmation.

## Snippets

Snippets are addressed by Snowflake id or `<reference>/<name>`. A bare name without `/` resolves as `root/<name>`.

| Command                             | Description                                                                |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `mxs snippet list`                  | List snippets (`--page` / `--size`); `--grouped` groups by reference.      |
| `mxs snippet get <id\|ref/name>`    | Show a single snippet, including `raw`.                                    |
| `mxs snippet create --name <name>`  | Create a snippet.                                                          |
| `mxs snippet update <id\|ref/name>` | Update a snippet (full-body merge onto the existing snippet).              |
| `mxs snippet edit <id\|ref/name>`   | Open the snippet `raw` content in `$EDITOR` (extension derived from type). |
| `mxs snippet delete <id\|ref/name>` | Delete a snippet. Requires `--force` in non-TTY contexts.                  |

### Snippet Write Flags

| Flag                       | Field                                                       |
| -------------------------- | ----------------------------------------------------------- |
| `--name <name>`            | `name` (required for `create`)                              |
| `--reference <r>`          | `reference` (defaults to `root` server-side)                |
| `--type <t>`               | `type`: `json`, `json5`, `function`, `text`, `yaml`, or `skill` |
| `--file <path\|->`          | Read `raw` content from a file; `-` reads stdin             |
| `--raw <text>`             | Inline `raw` content                                        |
| `--private` / `--no-private` | `private`                                                 |
| `--comment <text>`         | `comment`                                                   |
| `--enable` / `--no-enable` | `enable`                                                    |
| `--method <m>`             | `method`: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, or `ALL` |
| `--metatype <text>`        | `metatype`                                                  |
| `--schema <text>`          | `schema`                                                    |
| `--custom-path <p>`        | `customPath`                                                |
| `--secret <k=v>`           | `secret` (qs string)                                        |

Raw content sources are mutually exclusive and resolve in order: `--file`, then `--raw`. `create` additionally falls back to piped stdin when stdin is not a TTY, and with no source at all opens `$EDITOR` on an empty buffer when interactive (fails otherwise). `update` never reads stdin implicitly — pass `--file -` to read stdin explicitly.

```bash
mxs snippet create --name theme --reference web --type json --file theme.json
echo '{"a":1}' | mxs snippet create --name config
mxs snippet edit web/theme
```

### Skill snippets

The `skill` type stores a Claude Code-style skill bundle (YAML frontmatter + markdown body). On create/update the server parses the frontmatter, enforces that frontmatter `name` matches the snippet `name`, requires a non-empty `description`, copies the description into `comment`, and auto-fills `customPath` to `sk/<name>` when not set. The raw markdown (including frontmatter) is served at `/api/v3/s/sk/<name>` with `Content-Type: text/markdown`.

```bash
mxs snippet create --name db-migration-author --type skill --file SKILL.md
# attach to a post via meta.skillIds on `mxs post create`/`update`
```

A minimal `SKILL.md`:

```markdown
---
name: db-migration-author
description: Expand-contract Postgres migrations safe for rolling deploys.
---

## When to use

Use when authoring or reviewing any Postgres migration in this codebase.
```

## AI

Manage AI artifacts (summary, translation, insights) produced by the core AI module. Article references accept Snowflake id, post slug, or note nid — the CLI resolves to an article id via post-then-note lookup. Record references (`<recordId>`) are raw Snowflakes.

Generate verbs (`summary regen`, `translate run`, `insights refresh`) enqueue a task on the server, then poll `GET /tasks/:id` until the task reaches a terminal status (`completed`, `partial_failed`, `failed`, `cancelled`). Progress lines write to stderr. Pass `--no-wait` to return immediately with `status: pending` after the task is created. If the server reports `created: false`, an in-flight deduplicated task already exists and the CLI joins it instead of erroring. The polling cadence is 1000 ms by default; override via `MXS_AI_POLL_MS=<n>` for tests.

### Summary

| Command                                            | Description                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `mxs ai summary regen <id> [--to <lang>...]`       | Regenerate an article's summary (optionally for given languages). |
| `mxs ai summary list [--page <n>] [--size <n>] [--grouped]` | List summaries (flat or grouped by article).             |
| `mxs ai summary get <recordId>`                    | Get one summary by record id.                                     |
| `mxs ai summary by-article <id> [--lang <l>] [--only-db]` | Show an article's summary; `--only-db` skips auto-generate. |
| `mxs ai summary edit <recordId>`                   | Edit the `summary` field via `$EDITOR` (JSON envelope).           |
| `mxs ai summary delete <recordId> [--force]`       | Delete a summary record.                                          |

### Translate

| Command                                                  | Description                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `mxs ai translate run <id> --to <lang>... [--no-wait]`   | Translate an article into one or more languages (`--to` required, repeatable). |
| `mxs ai translate list [--page <n>] [--size <n>]`        | List translations (always grouped by article — no flat list server-side). |
| `mxs ai translate get <recordId>`                        | Get one translation by record id.                             |
| `mxs ai translate by-article <id> [--lang <l>]`          | Show an article's translations (single lang or all).          |
| `mxs ai translate languages <id>`                        | List languages an article has been translated into.           |
| `mxs ai translate edit <recordId>`                       | Edit translation fields via `$EDITOR` (JSON envelope).        |
| `mxs ai translate delete <recordId> [--force]`           | Delete a translation record.                                  |

### Translation Entries

The i18n dictionary entries layer used by category / topic / note metadata. `--key-path` accepts only the server-validated set: `category.name`, `topic.name`, `topic.introduce`, `topic.description`, `note.mood`, `note.weather`.

| Command                                                                       | Description                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `mxs ai translate entries list [--page <n>] [--size <n>] [--key-path <p>] [--lang <l>]` | List entries with optional filters.       |
| `mxs ai translate entries generate [--key-path <p>...] [--to <lang>...]`      | Trigger regeneration of entries.                       |
| `mxs ai translate entries edit <recordId>`                                    | Edit `translatedText` via `$EDITOR` (JSON envelope).   |
| `mxs ai translate entries delete <recordId> [--force]`                        | Delete an entry.                                       |

### Insights

| Command                                                | Description                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `mxs ai insights refresh <id> [--no-wait]`             | Refresh AI insights for an article.                                 |
| `mxs ai insights list [--page <n>] [--size <n>] [--grouped]` | List insights (flat or grouped by article).                   |
| `mxs ai insights get <recordId>`                       | Get one insights record by record id.                               |
| `mxs ai insights by-article <id> [--lang <l>] [--only-db]` | Show an article's insights; `--only-db` skips auto-generate.    |
| `mxs ai insights edit <recordId>`                      | Edit the `content` field via `$EDITOR` (JSON envelope).             |
| `mxs ai insights delete <recordId> [--force]`          | Delete an insights record.                                          |

```bash
mxs ai summary regen my-post --to en --to ja
mxs ai translate run my-post --to en
mxs ai insights refresh my-post
mxs ai summary list --grouped
mxs ai translate languages my-post
```

## Configuration

| Command                        | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `mxs config list`              | Read all server options from `/options`.                       |
| `mxs config get <key>`         | Read one server option.                                        |
| `mxs config set <key> <value>` | Patch one server option.                                       |
| `mxs config edit`              | Open all options in `$EDITOR`, then patch changed JSON values. |

### Config Set Flags

| Flag            | Effect                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `--type json`   | Parse value as JSON and fail on invalid JSON.                          |
| `--type string` | Store the value as a string.                                           |
| `--type number` | Parse the value as a number.                                           |
| `--type bool`   | Store `true` only when the value is exactly `true`; otherwise `false`. |

Without `--type`, `config set` attempts JSON parsing first and falls back to string.

## Content Sources

`--content` accepts the following grammar:

| Spec                         | Meaning                          |
| ---------------------------- | -------------------------------- |
| `--content="inline literal"` | Use the argument value directly. |
| `--content=file=<path>`      | Read body content from a file.   |
| `--content=-`                | Read body content from stdin.    |
| `--content=stdin`            | Read body content from stdin.    |

`--meta`, `--images`, and other JSON spec fields accept either an inline JSON literal or `file=<path>`.

## LiteXML Envelopes

LiteXML envelopes can carry metadata and body content in one file. Flag values override envelope metadata.
Use `--file -` to read an envelope from stdin.

### Post Envelope

```xml
<mxpost>
  <meta>
    <title>Title</title>
    <slug>my-post</slug>
    <category>tech</category>
    <tags><tag>cli</tag><tag>ai</tag></tags>
    <state>publish</state>
    <summary>Summary</summary>
    <format>lexical</format>
  </meta>
  <content>
    <p>Body.</p>
  </content>
</mxpost>
```

### Note Envelope

```xml
<mxnote>
  <meta>
    <title>Daily Note</title>
    <slug>daily-note</slug>
    <topic>life</topic>
    <state>draft</state>
    <mood>calm</mood>
    <weather>clear</weather>
    <format>lexical</format>
  </meta>
  <content>
    <p>Body.</p>
  </content>
</mxnote>
```

`lexical` envelope content is parsed through `@haklex/rich-litexml` and converted to Lexical JSON before writing to the server. `markdown` content is sent as-is.

## Configuration Files

| File                                       | Mode   | Purpose                                                                    |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| `~/.config/mxs/current`                    | `0644` | Active profile name (single line).                                         |
| `~/.config/mxs/profiles/<name>/config.json`      | `0644` | API URL, API base, auth base, API version, client id, and production flag. |
| `~/.config/mxs/profiles/<name>/credentials.json` | `0600` | Access token, refresh token, expiry, and optional user profile.            |

`XDG_CONFIG_HOME` changes the base directory. Profile directories are created with mode `0700`. Credentials files with wider permissions are automatically changed to `0600`.

Example profile config:

```json
{
  "api_url": "https://blog.example.com",
  "api_base": "https://blog.example.com/api/v2",
  "auth_base": "https://blog.example.com/api/v2/auth",
  "api_version": 2,
  "client_id": "mxs-cli",
  "production": true
}
```

## Environment Variables

| Variable          | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `MXS_API_URL`     | API origin override.                                                     |
| `MXS_TOKEN`       | Better Auth access token override; sent as `Authorization: Bearer`.      |
| `MXS_API_KEY`     | API key override; sent as `x-api-key`.                                   |
| `MXS_PROFILE`     | Profile to use; overrides the `current` pointer.                         |
| `MXS_DEBUG=1`     | Enables verbose HTTP diagnostics in auth helpers.                        |
| `EDITOR`          | Editor used by `post edit`, `note edit`, `page edit`, and `config edit`. |
| `XDG_CONFIG_HOME` | Base directory for `mxs` config files.                                   |

## Exit Codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| `0`  | Success                                                                      |
| `1`  | Generic failure                                                              |
| `2`  | Argument parsing failure                                                     |
| `3`  | Authentication or authorization failure                                      |
| `4`  | Network failure; also profile write gate (`profile.write_requires_explicit`) and no active profile (`profile.none_active`) |
| `5`  | Validation or configuration failure                                          |
| `6`  | Server 5xx failure                                                           |
| `7`  | Resource not found                                                           |

## Preview

`mxs preview <file>` renders a LiteXML fragment or `<mxpost>` / `<mxnote>` envelope to HTML and opens it in your default browser. Use it to sanity-check what the article will look like before publishing.

```bash
mxs preview ./post.xml                 # open in browser
mxs preview - < note.xml               # read stdin
mxs preview ./post.xml --theme dark    # dark theme
mxs preview ./post.xml --save out.html # write HTML to file
mxs preview ./post.xml --print         # emit HTML to stdout
```

The variant (`article` / `note`) is auto-detected from the envelope root. Override with `--variant` for raw LiteXML fragments. The command does not contact `mx-core` — it uses the LiteXML preview renderer vendored into the published CLI bundle.

## Skill bundle

`mxs skill` exposes the bundled AI-agent documentation directly from the CLI binary. Chapters are shipped inside the published `@mx-space/cli` package; liteXML chapters are pulled live from `@haklex/rich-litexml` at runtime (requires `@haklex/rich-litexml@>=0.16.0`).

| Command                          | Behaviour                                                  |
| -------------------------------- | ---------------------------------------------------------- |
| `mxs skill`                      | List every chapter (slug + one-line description).          |
| `mxs skill get <slug>`           | Print one chapter; default output is markdown for agents.  |
| `mxs skill all`                  | Concatenate every chapter in registry order.               |
| `mxs skill search <keyword>`     | Substring search across title / description / body.        |

All four verbs honour the global `--json`, `--output llm`, `--output xml`, and `--output readable` flags.

Override paths for development or vendoring:

| Variable                | Effect                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `MXS_SKILL_CLI_DIR`     | Override the CLI-native skill directory (default: `<pkg>/skills/`).    |
| `MXS_SKILL_HAKLEX_DIR`  | Override the haklex liteXML skill directory.                           |

## Troubleshooting

| Symptom                                            | Resolution                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `cannot detect auth endpoint`                      | Verify that the URL points to a live mx-core server with device authorization enabled. Use `--verbose` to inspect probes. |
| `API URL is not configured`                        | Set `MXS_API_URL`, pass `--api-url`, or run `mxs auth login` in an interactive terminal.                                  |
| `EDITOR is not set`                                | Set `EDITOR`, for example `EDITOR=vim`.                                                                                   |
| API key no longer works in `Authorization: Bearer` | Use `--api-key` or `MXS_API_KEY` for API keys. Bearer auth is reserved for Better Auth session/OIDC access tokens.         |
| `profile.write_requires_explicit` on a write command | The active profile is marked production. Retry with `--profile <name>` or `MXS_PROFILE=<name>` to confirm intent.        |
| `profile.none_active`                              | No active profile set. Run `mxs auth login` to create one, or `mxs profile use <name>` to activate an existing profile.  |

## v0.3.0 behavior changes

The Effect-TS rewrite is intentionally surface-preserving. Behaviorally observable changes versus v0.2.x are:

- **No first-run onboarding prompt.** Previous versions launched an interactive `runOnboarding` flow when no API URL was configured. v0.3 follows the static resolution chain (`--api-url` → `MXS_API_URL` → active profile → error) and reports `config.missing.api_url` (`exit 5`) when nothing resolves. Run `mxs auth login` to create the first profile.
- **`--help` output formatting.** Help text is rendered by `@effect/cli` and looks slightly different — wider option summaries, ANSI styling, and synopsis lines — but the option/flag set and exit code (`0`) are unchanged.
- **JavaScript API surface is minimal.** The public package entry (`@mx-space/cli`) now re-exports only `run` plus the error tag table from `src/index.ts`. Importing internal services or core utilities is no longer supported; depend on the CLI binary instead.

Anything else (exit codes, JSON envelopes, output-mode rendering, write-gate refusal semantics) is byte-equivalent to v0.2.x per the design spec.

## License

AGPL-3.0.
