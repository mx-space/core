---
slug: overview
title: Overview
description: Entry point and reference map for the bundled mxs skill
order: 0
---

# mxs CLI — AI agent skill bundle

`mxs` is the deterministic interface for managing an `mx-core` deployment from the command line — authentication, content (posts, notes, pages, projects), moderation, configuration. This skill bundle is shipped inside the published `@mx-space/cli` package so any agent with the installed binary can read it via `mxs skill <slug>`.

The audience is **AI agents**. Pass `--output llm` for raw markdown suitable for direct context injection. Default output is `readable` (markdown rendered as ANSI for a terminal).

## Read by intent, not by slug

**Read this chapter first, then load `workflow` plus the one chapter your intent names.** That pair covers almost every task; do not guess slugs from the chapter list.

| I want to …                                                        | Read                                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Drive any task end-to-end without damaging server state            | `workflow`                                                                                      |
| See what a change renders as, without writing to the server        | `commands-author`                                                                               |
| Edit an existing post, add a section, fix a typo                   | `commands-post` + `authoring` + `commands-author`                                               |
| Write LiteXML that will actually parse (tags, attributes, recipes) | `litexml` + `litexml-nodes-structural`, `litexml-nodes-extensions`, `litexml-authoring-recipes` |
| Upload an image / icon / avatar / file and get a public URL        | `commands-file`                                                                                 |
| Stage changes without touching the published article               | `commands-draft`                                                                                |
| Confirm which deployment and account this shell is talking to      | `auth-config`                                                                                   |
| Produce output a program will parse                                | `output-modes`                                                                                  |
| Delete, publish, or overwrite something irreversible               | `safety`                                                                                        |
| Notes / pages / portfolio projects                                 | `commands-note`, `commands-page`, `commands-project`                                            |
| Moderate comments                                                  | `commands-comment`                                                                              |
| Categories / topics                                                | `commands-category`, `commands-topic`                                                           |
| Server-side data and functions                                     | `commands-snippet`                                                                              |
| AI summary / translation / insights / tts / overview               | `commands-ai`                                                                                   |
| Server options                                                     | `commands-config`                                                                               |
| Log in and out                                                     | `commands-auth`                                                                                 |
| Local CLI profiles                                                 | `commands-profile`                                                                              |

Chapters map to command groups. If a command has no chapter, `mxs <command> --help` is authoritative — the CLI is the source of truth, not this bundle.

`litexml*` chapters (`litexml`, `litexml-nodes-structural`, `litexml-nodes-extensions`, `litexml-authoring-recipes`, `litexml-cli`) are shipped from `@haklex/rich-litexml`, not from this package — their slugs change with that dependency. If they are missing, upgrade haklex to a version that bundles its `.claude/skills/litexml-authoring/` directory. Run `mxs skill` to see the slugs actually loaded rather than trusting this list.

## How to navigate

- `mxs skill` — list every chapter (slug + one-liner)
- `mxs skill get <slug>` — print the chapter body as raw markdown
- `mxs skill all` — concatenate every chapter (for one-shot context injection)
- `mxs skill search <keyword>` — substring search, returns matching chapters with snippets

Chapters carry an `order` field and print in ascending order; `overview` is `order: 0` and always comes first.
