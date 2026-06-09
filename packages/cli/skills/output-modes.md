---
slug: output-modes
title: Output modes
description: --json / --output (readable, llm, xml, pretty-json) and global flags
order: 41
---

# Output modes

| Mode          | Shape                                                                          | Primary use                                       |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `pretty-json` | Raw response payload formatted with indentation.                               | Human inspection.                                 |
| `json`        | `{ ok: true, data }` JSON envelope. Errors emit `{ ok: false, code, message }`. | Scripts and structured automation.               |
| `readable`    | Compact metadata plus readable body. Default.                                  | Human terminal reading.                           |
| `llm`         | Stable, low-noise structure optimised for agent context.                       | Document read-back inside an AI pipeline.         |
| `xml`         | `<mxpost>` or `<mxnote>` LiteXML envelope for document responses.              | Editable document round trips.                    |

`--json` is a shorthand for `--output json` and takes precedence over `--output`.

## Output selection rules

| Operation                         | Preferred output    |
| --------------------------------- | ------------------- |
| Mutation                          | `--json`            |
| Strict scripted read              | `--json`            |
| Document body verification        | `--output llm`      |
| Editable round trip               | `--output xml`      |
| Human terminal review             | `--output readable` |

For Lexical documents, `readable`, `llm`, and `xml` render the body through LiteXML instead of exposing raw Lexical JSON.

## Global flags

| Flag                | Applies to                                                                  | Effect                                                       |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `--json`            | all commands                                                                | Emit `{ ok: true, data }` on success; structured error JSON. |
| `--output <mode>`   | all commands                                                                | One of `pretty-json`, `json`, `readable`, `llm`, `xml`.      |
| `--api-url <url>`   | all server commands                                                         | Override configured `mx-core` origin.                        |
| `--token <token>`   | all authenticated commands                                                  | Better Auth bearer token.                                    |
| `--api-key <key>`   | all authenticated commands                                                  | Sent as `x-api-key`.                                         |
| `--lang <code>`     | read endpoints                                                              | Request translated read data for a locale.                   |
| `--profile <name>`  | all commands                                                                | Use the named profile for this invocation.                   |
| `--quiet`, `-q`     | all commands                                                                | Suppress non-error stderr.                                   |
| `--verbose`         | all server commands                                                         | Print HTTP method, URL, status, and duration to stderr.      |
| `--dry-run`         | supported mutation commands                                                 | Resolve payload or action without mutating the server.       |
