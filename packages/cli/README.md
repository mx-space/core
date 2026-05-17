# @mx-space/cli (`mxs`)

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
mxs post create --file ./post.xml
mxs post update my-slug --title "New title" --state publish
mxs post get my-slug --output llm
```

When the CLI cannot resolve an API URL, it starts an interactive onboarding prompt in TTY contexts. Use `MXS_API_URL` or `--api-url` for non-interactive environments.

## Global Flags

| Flag              | Effect                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| `--json`          | Emit `{ ok: true, data }` on stdout. Takes precedence over `--output`.        |
| `--output <mode>` | Output mode. Supported: `pretty-json`, `json`, `readable`, `llm`, `envelope`. |
| `--api-url <url>` | Override the configured mx-core API origin.                                   |
| `--token <token>` | Override the stored access token.                                             |
| `--quiet`, `-q`   | Suppress non-error stderr messages.                                           |
| `--verbose`       | Print HTTP method, URL, status, and duration to stderr.                       |
| `--dry-run`       | Resolve payloads without mutating the server where supported.                 |

`readable`, `llm`, and `envelope` are currently document output modes for `post get`, `note get`, and `page get`. Other commands keep their existing JSON-oriented output.

## Output Modes

| Mode          | Shape                                            | Primary Use                                   |
| ------------- | ------------------------------------------------ | --------------------------------------------- |
| `pretty-json` | Raw response payload formatted with indentation. | Human inspection and existing behavior.       |
| `json`        | `{ ok: true, data }` JSON envelope.              | Scripts and structured automation.            |
| `readable`    | Compact key-value metadata plus readable body.   | Human terminal reading.                       |
| `llm`         | Same stable readable structure as `readable`.    | AI-agent context with lower structural noise. |
| `envelope`    | `<mxpost>` or `<mxnote>` LiteXML envelope.       | Editable document round trips.                |

For Lexical documents, `readable`, `llm`, and `envelope` render the body as LiteXML through `@haklex/rich-litexml` instead of exposing Lexical JSON.

Example:

```bash
mxs post get my-slug --output llm
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
| `mxs auth whoami` | Show the stored authenticated user and resolved API URL.                |
| `mxs auth status` | Show token presence, expiry, refresh-token availability, and user data. |

`auth login` prints the verification URL and user code. In non-JSON interactive mode, it attempts to open the complete verification URL in the browser.

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

### Note Write Flags

| Flag                   | Field                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `--title <text>`       | `title`; defaults to `无题` for create payloads.                       |
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

| File                             | Mode   | Purpose                                                         |
| -------------------------------- | ------ | --------------------------------------------------------------- |
| `~/.config/mxs/config.json`      | `0644` | API URL, API base, auth base, API version, and client id.       |
| `~/.config/mxs/credentials.json` | `0600` | Access token, refresh token, expiry, and optional user profile. |

`XDG_CONFIG_HOME` changes the base directory. Credentials with wider permissions are automatically changed to `0600`.

Example config:

```json
{
  "api_url": "https://blog.example.com",
  "api_base": "https://blog.example.com/api/v2",
  "auth_base": "https://blog.example.com/api/v2/auth",
  "api_version": 2,
  "client_id": "mxs-cli"
}
```

## Environment Variables

| Variable          | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `MXS_API_URL`     | API origin override.                                                     |
| `MXS_TOKEN`       | Access token override.                                                   |
| `MXS_DEBUG=1`     | Enables verbose HTTP diagnostics in auth helpers.                        |
| `EDITOR`          | Editor used by `post edit`, `note edit`, `page edit`, and `config edit`. |
| `XDG_CONFIG_HOME` | Base directory for `mxs` config files.                                   |

## Exit Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | Generic failure                         |
| `2`  | Argument parsing failure                |
| `3`  | Authentication or authorization failure |
| `4`  | Network failure                         |
| `5`  | Validation or configuration failure     |
| `6`  | Server 5xx failure                      |
| `7`  | Resource not found                      |

## Troubleshooting

| Symptom                                            | Resolution                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `cannot detect auth endpoint`                      | Verify that the URL points to a live mx-core server with device authorization enabled. Use `--verbose` to inspect probes. |
| `API URL is not configured`                        | Set `MXS_API_URL`, pass `--api-url`, or run `mxs auth login` in an interactive terminal.                                  |
| `EDITOR is not set`                                | Set `EDITOR`, for example `EDITOR=vim`.                                                                                   |
| API key no longer works in `Authorization: Bearer` | Use `x-api-key` for API keys. Bearer auth is reserved for Better Auth session/OIDC access tokens.                         |

## License

AGPL-3.0.
