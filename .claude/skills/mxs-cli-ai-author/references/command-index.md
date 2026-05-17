# mxs Command Index

This index reflects the command surface registered in `packages/cli/src/bin/mxs.ts`.

## Global Flags

| Flag | Applies To | Effect |
| --- | --- | --- |
| `--json` | all commands | Emit `{ ok: true, data }` on success; emit structured error JSON on failure. |
| `--output <mode>` | all commands; document modes mainly affect `post get`, `note get`, `page get` | Supported modes: `pretty-json`, `json`, `readable`, `llm`, `envelope`. |
| `--api-url <url>` | all server commands | Override configured mx-core origin. |
| `--token <token>` | all authenticated commands | Use Better Auth bearer token. |
| `--api-key <key>` | all authenticated commands | Use API key through `x-api-key`. |
| `--quiet`, `-q` | all commands | Suppress non-error stderr. |
| `--verbose` | all server commands | Print HTTP method, URL, status, and duration to stderr. |
| `--dry-run` | supported mutation commands | Resolve payload or action without mutating the server. |

## Auth Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `mxs auth login` | Start device authorization flow and store credentials. | In interactive non-JSON mode, attempts to open verification URL. |
| `mxs auth logout` | Delete stored credentials. | Does not delete server-side sessions. |
| `mxs auth whoami` | Show authenticated user and resolved API URL. | Use before mutation target confirmation. |
| `mxs auth status` | Show token presence, expiry, refresh-token availability, and user data. | Use before write workflows. |

## Post Commands

| Command | Purpose | Principal Flags |
| --- | --- | --- |
| `mxs post list` | List posts. | `--page <n>`, `--size <n>`, `--state <s>`, `--sort <s>` |
| `mxs post get <slugOrId>` | Read a post by Snowflake id or slug. | `--json`, `--output readable\|llm\|envelope` |
| `mxs post create` | Create a post. | post write flags |
| `mxs post edit <slugOrId>` | Edit via `$EDITOR` when no content flags are supplied; otherwise replace through flags or file. | post write flags |
| `mxs post update <slugOrId>` | Patch selected fields. Content remains unchanged unless `--content` or `--file` is supplied. | post write flags |
| `mxs post delete <slugOrId>` | Delete a post. | `--force`; use `--dry-run` first when possible. |
| `mxs post publish <slugOrId>` | Set `isPublished=true`. | supports `--dry-run` |
| `mxs post unpublish <slugOrId>` | Set `isPublished=false`. | supports `--dry-run` |

### Post List Flags

| Flag | Meaning |
| --- | --- |
| `--page <n>` | Page number. |
| `--size <n>` | Page size. |
| `--state <s>` | Publication filter, commonly `draft` or `publish`. |
| `--sort <s>` | Sort field, commonly `created` or `modified`. |

Current mx-core compatibility note: `post list --state publish` may be rejected by the server as an invalid numeric `state`. Prefer omitting `--state` when listing through an anonymous or read-only context, or verify the live API contract before relying on this filter. `--sort created` is forwarded as `sortBy=created`; the current server-side repository maps `createdAt`, `modifiedAt`, and `pinAt`, so verify ordering before treating the first row as latest.

### Post Write Flags

| Flag | Field Or Behavior |
| --- | --- |
| `--title <s>` | `title` |
| `--slug <s>` | `slug` |
| `--category <s>` | Category id, slug, or name; resolved to `categoryId`. |
| `--content <spec>` | Body source; see [Content Authoring](content-authoring.md). |
| `--format <s>` | `lexical` or `markdown`; default is `lexical`. |
| `--summary <s>` | `summary` |
| `--state <s>` | `publish` or `draft`; maps to `isPublished`. |
| `--tags <csv>` | Comma-separated tags. |
| `--copyright <b>` | `true` or `false`. |
| `--pin <iso>` | Pin timestamp or date. |
| `--pin-order <n>` | Numeric pin order. |
| `--related <csv>` | Comma-separated related document ids. |
| `--meta <spec>` | JSON literal or `file=<path>`. |
| `--file <path>` | LiteXML envelope. |

## Note Commands

| Command | Purpose | Principal Flags |
| --- | --- | --- |
| `mxs note list` | List notes. | `--page <n>`, `--size <n>`, `--state <s>`, `--sort <s>` |
| `mxs note get <slugOrId>` | Read by Snowflake id, numeric nid, or direct identifier. | `--json`, `--output readable\|llm\|envelope` |
| `mxs note create` | Create a note. | note write flags |
| `mxs note edit <slugOrId>` | Edit via `$EDITOR` when no content flags are supplied; otherwise replace through flags or file. | note write flags |
| `mxs note update <slugOrId>` | Patch selected fields. Content remains unchanged unless `--content` or `--file` is supplied. | note write flags |
| `mxs note delete <slugOrId>` | Delete a note. | `--force`; use `--dry-run` first when possible. |
| `mxs note publish <slugOrId>` | Set `isPublished=true`. | supports `--dry-run` |
| `mxs note unpublish <slugOrId>` | Set `isPublished=false`. | supports `--dry-run` |

### Note List Flags

| Flag | Meaning |
| --- | --- |
| `--page <n>` | Page number. |
| `--size <n>` | Page size. |
| `--state <s>` | Publication filter. |
| `--sort <s>` | Sort field passed as `sortBy`. |

Current mx-core compatibility note: verify the live note list query contract before using `--state`; do not assume post and note list filters accept the same value shape.

### Note Write Flags

| Flag | Field Or Behavior |
| --- | --- |
| `--title <s>` | `title`; create defaults to `无题` when omitted. |
| `--slug <s>` | `slug` |
| `--topic <s>` | Topic id, slug, or name; resolved to `topicId`. |
| `--content <spec>` | Body source; see [Content Authoring](content-authoring.md). |
| `--format <s>` | `lexical` or `markdown`; default is `lexical`. |
| `--state <s>` | `publish` or `draft`; maps to `isPublished`. |
| `--mood <s>` | `mood` |
| `--weather <s>` | `weather` |
| `--public-at <iso>` | `publicAt` |
| `--password <s>` | `password` |
| `--bookmark <b>` | `true` or `false`. |
| `--coords <s>` | `lat,lng`; maps to `{ latitude, longitude }`. |
| `--location <s>` | `location` |
| `--images <spec>` | JSON literal or `file=<path>`. |
| `--meta <spec>` | JSON literal or `file=<path>`. |
| `--file <path>` | LiteXML envelope. |

## Page Commands

| Command | Purpose | Principal Flags |
| --- | --- | --- |
| `mxs page list` | List pages. | global flags |
| `mxs page get <slugOrId>` | Read by Snowflake id or slug. | `--json`, `--output readable\|llm\|envelope` |
| `mxs page create` | Create a page. | page write flags |
| `mxs page edit <slugOrId>` | Edit via `$EDITOR` when no content flags are supplied; otherwise replace through flags or file. | page write flags |
| `mxs page update <slugOrId>` | Patch selected fields. Content remains unchanged unless `--content` or `--file` is supplied. | page write flags |
| `mxs page delete <slugOrId>` | Delete a page. | `--force`; use `--dry-run` first when possible. |

### Page Write Flags

| Flag | Field Or Behavior |
| --- | --- |
| `--title <s>` | `title` |
| `--slug <s>` | `slug` |
| `--subtitle <s>` | `subtitle` |
| `--order <n>` | Numeric page order. |
| `--content <spec>` | Body source; see [Content Authoring](content-authoring.md). |
| `--format <s>` | `lexical` or `markdown`; default is `lexical`. |
| `--meta <spec>` | JSON literal or `file=<path>`. |
| `--file <path>` | LiteXML envelope. Pages currently reuse `<mxpost>`. |

## Category Commands

| Command | Purpose | Flags |
| --- | --- | --- |
| `mxs category list` | List categories and tags. | global flags |
| `mxs category get <slugOrId>` | Read a category or tag. | global flags |
| `mxs category create` | Create a category or tag. | required: `--name <s>`, `--slug <s>`; optional: `--type <s>`, `--icon <s>` |
| `mxs category update <slugOrId>` | Patch category or tag fields. | `--name <s>`, `--slug <s>`, `--type <s>`, `--icon <s>` |
| `mxs category delete <slugOrId>` | Delete a category or tag. | `--force`; use `--dry-run` first when possible. |

`--type` accepts `category` or `tag` and maps to the server category type.

## Topic Commands

| Command | Purpose | Flags |
| --- | --- | --- |
| `mxs topic list` | List all topics. | global flags |
| `mxs topic get <slugOrId>` | Read a topic by Snowflake id or slug. | global flags |
| `mxs topic create` | Create a topic. | required: `--name <s>`, `--slug <s>`; optional: `--description <s>`, `--icon <s>` |
| `mxs topic update <slugOrId>` | Patch topic fields. | `--name <s>`, `--slug <s>`, `--description <s>`, `--icon <s>` |
| `mxs topic delete <slugOrId>` | Delete a topic. | `--force`; use `--dry-run` first when possible. |

## Config Commands

| Command | Purpose | Flags |
| --- | --- | --- |
| `mxs config list` | Read all server options from `/options`. | global flags |
| `mxs config get <key>` | Read one server option. | global flags |
| `mxs config set <key> <value>` | Patch one server option. | `--type json\|string\|number\|bool` |
| `mxs config edit` | Open all options in `$EDITOR`, then patch changed JSON values. | supports `--dry-run` |

Without `--type`, `config set` attempts JSON parsing first and falls back to string.

## Mutation Dry-Run Coverage

| Area | Supported Commands |
| --- | --- |
| Posts | `create`, `edit`, `update`, `delete`, `publish`, `unpublish` |
| Notes | `create`, `edit`, `update`, `delete`, `publish`, `unpublish` |
| Pages | `create`, `edit`, `update`, `delete` |
| Categories | `create`, `update`, `delete` |
| Topics | `create`, `update`, `delete` |
| Config | `set`, `edit` |
