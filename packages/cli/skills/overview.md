---
slug: overview
title: Overview
description: Entry point and reference map for the bundled mxs skill
order: 0
---

# mxs CLI — AI agent skill bundle

`mxs` is the deterministic interface for managing an `mx-core` deployment from the command line — authentication, content (posts, notes, pages, projects), moderation, configuration. This skill bundle is shipped inside the published `@mx-space/cli` package so any agent with the installed binary can read it via `mxs skill <slug>`.

The audience is **AI agents**. Pass `--output llm` for raw markdown suitable for direct context injection. Default output is `readable` (markdown rendered as ANSI for a terminal).

## Reference map

| Need                                          | Chapter                          |
| --------------------------------------------- | -------------------------------- |
| How to drive any task end-to-end              | `workflow`                       |
| Post / note / page content authoring          | `authoring`                      |
| Exact command syntax for posts                | `commands-post`                  |
| Notes                                         | `commands-note`                  |
| Pages                                         | `commands-page`                  |
| Portfolio projects                            | `commands-project`               |
| Comments / moderation                         | `commands-comment`               |
| Categories                                    | `commands-category`              |
| Topics                                        | `commands-topic`                 |
| Snippets (server data / functions)            | `commands-snippet`               |
| Server-side options                           | `commands-config`                |
| Authentication                                | `commands-auth`                  |
| Local profile management                      | `commands-profile`               |
| Browser preview of LiteXML / envelopes        | `commands-preview`               |
| Profiles, env vars, target selection          | `auth-config`                    |
| Output modes (`--json`, `--output llm`, …)    | `output-modes`                   |
| Mutation safety, verification, exit codes     | `safety`                         |
| LiteXML syntax for `<mxpost>` / `<mxnote>`    | `litexml`, `litexml-nodes`, `litexml-recipes`, `litexml-cli` |

`litexml*` chapters are shipped from `@haklex/rich-litexml`. If they are missing, upgrade haklex to a version that bundles its `.claude/skills/litexml-authoring/` directory.

## How to navigate

- `mxs skill` — list every chapter (slug + one-liner)
- `mxs skill get <slug>` — print the chapter body as raw markdown
- `mxs skill all` — concatenate every chapter (for one-shot context injection)
- `mxs skill search <keyword>` — substring search, returns matching chapters with snippets
