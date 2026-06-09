---
slug: safety
title: Safety, troubleshooting, exit codes
description: mutation safety matrix, common failures, verification templates
order: 60
---

# Safety and troubleshooting

Use this reference for every mutation, deletion, publication change, or failed command.

## Mutation safety matrix

| Operation                           | Required guard                                                              | Required verification                                       |
| ----------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Create post/note/page               | Confirm target and run `--dry-run` when practical.                          | `get <slugOrId>` and compare metadata plus body sample.     |
| Update post/note/page               | Prefer partial flags when body is unchanged.                                | Confirm changed fields and unchanged body when applicable.  |
| Edit post/note/page                 | Avoid `$EDITOR` in non-interactive workflows unless explicitly requested.   | Read back the full document.                                |
| Create/update project               | `name` is server-unique; duplicates fail with `PROJECT_NAME_TAKEN` (409). Prefer `update` with partial flags over `edit` in non-interactive runs. | `project get <nameOrId>` and compare fields.                |
| Publish/unpublish                   | Confirm publication intent and target.                                      | Read back `state` or `isPublished`.                         |
| Delete                              | Confirm destructive intent and target; prefer `--dry-run`; use `--force` only when non-interactive deletion is intentional. | Confirm `get` fails with not found or list no longer includes the resource. |
| Config set/edit                     | Confirm target because changes affect server behavior.                      | `config get <key>` or `config list`.                        |
| Category/topic changes              | Confirm dependent content implications before deletion or slug changes.     | `category get/list` or `topic get/list`.                    |
| Comment approve/reject              | State change is soft and reversible; explicit-id form runs without confirmation. | `comment get <id> --json` and confirm `state`.         |
| Comment delete                      | Soft-delete; `--force` required in non-TTY for both single id and `--all`.  | `comment list --state <s>` or `comment get <id>` confirms removal. |
| Comment `--all`                     | Mass operation; always pass `--force` in non-TTY and prefer narrowing with `--state`. | `comment list --all --json` to confirm post-state. |

`--dry-run` validates local payload construction only; it does not contact the server and does not prove write authorization. If the actual mutation returns `auth.expired`, `auth.denied`, or `未登录`, stop and obtain a server-valid Better Auth token or API key instead of retrying with the same stored credential.

## Non-interactive rules

| Context           | Rule                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| Agent mutation    | Always pass `--json`.                                                 |
| Non-TTY delete    | `--force` is required after target confirmation.                      |
| Stdin content     | Use `--content=-`, `--content=stdin`, or `--file -`; fail if stdin is a TTY. |
| Editor workflow   | Requires `EDITOR`; avoid unless user requested manual editor semantics. |

## Common failures

| Symptom or code                                       | Likely cause                                                                  | Resolution                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `config.missing.api_url`                              | No target configured.                                                         | Set `MXS_API_URL`, pass `--api-url`, or run `mxs auth login` interactively. |
| `cannot detect auth endpoint`                         | URL does not point to a live `mx-core` server with device auth.               | Check origin and use `--verbose` for probes.                               |
| `fetch failed`                                        | Server unavailable or incorrect target.                                       | Start local server or select intended API origin.                          |
| `auth.expired`                                        | Expired bearer token or API key supplied as bearer token.                     | Refresh login, pass valid `MXS_TOKEN`, or use `MXS_API_KEY` for API keys.   |
| `auth.denied`                                         | Insufficient permission.                                                      | Confirm credential owner and target.                                       |
| `validation.failed`                                   | Invalid flags, missing required fields, bad JSON, invalid coordinates, or empty lexical content. | Inspect JSON specs, envelope metadata, and content source.       |
| `validation.xml`                                      | Invalid LiteXML envelope.                                                     | Check root tag, `<meta>`, `<content>`, nested tags, and line detail.        |
| `resource.not_found`                                  | Wrong slug/id, deleted resource, or wrong target.                             | Re-run list/get on the confirmed target.                                   |
| `profile.write_requires_explicit`                     | Active profile is flagged production; mutation refused without `--profile`.   | Pass `--profile <name>` explicitly, or `mxs profile mark <name> --no-production`. |
| `skill.chapter_not_found`                             | Requested chapter slug is not in the registry.                                | `mxs skill` to list; for `litexml-*` upgrade `@haklex/rich-litexml` to ≥0.16.0. |
| `EDITOR is not set`                                   | Interactive edit requested without editor.                                    | Set `EDITOR` or use flags/file instead.                                    |
| Large noisy JSON output                               | Raw document payload is too verbose.                                          | Use `--output llm` for read-back and `--json` for mutations.                |
| Link or embed URLs become empty during dry-run        | LiteXML round-trip lost node attributes or the agent is using an older CLI build. | Stop before writing; update/fix the CLI and repeat dry-run before mutation. |

## Exit codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| `0`  | Success                                       |
| `1`  | Generic failure                               |
| `2`  | Argument parsing failure                      |
| `3`  | Authentication or authorization failure       |
| `4`  | Network failure                               |
| `5`  | Validation or configuration failure           |
| `6`  | Server 5xx failure                            |
| `7`  | Resource not found (incl. skill chapter)      |

## Verification templates

### Post

```bash
mxs post get <slugOrId> --output llm
mxs post get <slugOrId> --json
```

Verify `title`, `slug`, `state`, category, tags, summary, and representative body text.

### Note

```bash
mxs note get <slugOrId> --output llm
mxs note get <slugOrId> --json
```

Verify `title`, `slug` or `nid`, `state`, topic, note metadata, and representative body text.

### Page

```bash
mxs page get <slugOrId> --output llm
mxs page get <slugOrId> --json
```

Verify `title`, `slug`, `subtitle`, `order`, and representative body text.

### Project

```bash
mxs project get <nameOrId> --output llm
mxs project get <nameOrId> --json
```

Verify `name`, `description`, link URLs (`previewUrl`, `projectUrl`, `docUrl`), avatar, image count, and representative `text`.

### Config

```bash
mxs config get <key> --json
mxs config list --json
```

Verify only the intended option changed.

### Comment

```bash
mxs comment get <id> --json
mxs comment list --state <unread|read|junk> --json
```

Verify `state` matches the intended transition (`0=unread`, `1=read`, `2=junk`) and, for delete, that the id no longer appears in `comment list`.
