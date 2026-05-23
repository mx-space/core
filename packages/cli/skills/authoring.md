---
slug: authoring
title: Content authoring (posts, notes, pages)
description: Drafting workflows, content sources, envelope precedence
order: 20
---

# Content authoring

Use this reference when drafting or modifying posts, notes, or pages.

## Resource selection

| Resource | Association | Publish commands                  | Envelope root |
| -------- | ----------- | --------------------------------- | ------------- |
| Post     | Category    | `post publish`, `post unpublish`  | `<mxpost>`    |
| Note     | Topic       | `note publish`, `note unpublish`  | `<mxnote>`    |
| Page     | none        | no dedicated publish command      | `<mxpost>`    |

## Preferred drafting sequence

```text
┌─────────────────────────┐
│ Resolve category/topic  │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Write LiteXML envelope  │  (see litexml chapter)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Dry-run create/update   │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Execute with --json     │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Read back with llm/json │
└─────────────────────────┘
```

## Content sources

| Spec                          | Meaning                                          |
| ----------------------------- | ------------------------------------------------ |
| `--content="inline literal"`  | Use the argument as body text.                   |
| `--content=file=<path>`       | Read body content from a file.                   |
| `--content=-`                 | Read body content from stdin.                    |
| `--content=stdin`             | Read body content from stdin.                    |
| `--file <path>`               | Read a LiteXML envelope with metadata and body.  |
| `--file -`                    | Read a LiteXML envelope from stdin.              |

`--meta`, `--images`, and comparable JSON fields accept either an inline JSON literal or `file=<path>`.

## Format rules

| Format     | Behavior                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `lexical`  | Default. LiteXML is parsed through `@haklex/rich-litexml` and stored as Lexical JSON; derived plain text is also sent. |
| `markdown` | Content is sent as markdown text without Lexical conversion.                                                   |

For `lexical`, empty content is invalid when a content source is provided.

## Flag and envelope precedence

| Rule                                                                                | Consequence                                                |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| CLI flags override envelope metadata.                                               | Use flags for last-mile corrections such as `--state draft`. |
| `update` preserves body when neither `--content` nor `--file` is supplied.          | Use partial updates for metadata-only changes.             |
| `edit` invokes `$EDITOR` when no content flags are supplied.                        | Avoid in non-interactive agent workflows unless explicitly requested. |
| Page file payloads use the post envelope parser.                                    | Use `<mxpost>` for page envelopes.                         |

## Existing lexical content with rich nodes

Do not blindly round-trip an existing Lexical document through `--output xml` and `post update --file` when it contains links, embeds, or other rich nodes. A dry-run must prove that URLs and node-specific attributes survive conversion. If dry-run output shows empty link URLs or empty embed URLs, stop before writing; otherwise the update can silently damage the article structure.

When only the body needs to change, prefer `post update --content - --format lexical` with the extracted `<content>` body instead of `--file`; this avoids unintentionally patching envelope metadata such as tags or category.

## Post envelope

```xml
<mxpost>
  <meta>
    <title>Title</title>
    <slug>stable-slug</slug>
    <category>tech</category>
    <tags>
      <tag>ai</tag>
    </tags>
    <state>draft</state>
    <summary>Short summary.</summary>
    <format>lexical</format>
    <copyright>true</copyright>
  </meta>
  <content>
<p>Paragraph.</p>
<h2>Section</h2>
<p>More content.</p>
  </content>
</mxpost>
```

Common commands:

```bash
mxs post create --file ./post.xml --json
mxs post update stable-slug --title "New title" --state draft --json
mxs post publish stable-slug --json
mxs post get stable-slug --output llm
```

## Note envelope

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

Common commands:

```bash
mxs note create --file ./note.xml --json
mxs note update daily-note --mood "focused" --json
mxs note publish daily-note --json
mxs note get daily-note --output llm
```

## Page envelope

Pages currently reuse the `<mxpost>` envelope shape. Page metadata supports `title`, `slug`, `subtitle`, `order`, `format`, and `meta`.

```xml
<mxpost>
  <meta>
    <title>About</title>
    <slug>about</slug>
    <subtitle>Profile and links</subtitle>
    <order>10</order>
    <format>lexical</format>
  </meta>
  <content>
<p>Page body.</p>
  </content>
</mxpost>
```

```bash
mxs page create --file ./page.xml --json
mxs page update about --subtitle "Updated subtitle" --json
mxs page get about --output llm
```

## `meta` field — built-in presets

The `meta` column on posts, notes, and pages is a free-form JSON record;
mx-core does not validate keys. However a small set of keys are seeded as
**built-in presets** (`apps/core/src/modules/meta-preset/meta-preset.service.ts`)
and the frontend (Shiro / Yohaku) consumes them to render dedicated UI.
Prefer these keys for the documented purpose; do not invent parallel names.

| Key        | Type                  | Frontend behavior                                                  |
| ---------- | --------------------- | ------------------------------------------------------------------ |
| `aiGen`    | number or number[]    | Renders an `AIGenBadge` disclosing AI involvement. See below.      |
| `cover`    | URL string            | Used as the article / note cover image.                            |
| `banner`   | object                | Renders a notice banner above the body (`{type, message, className}`). |
| `keywords` | string[]              | SEO keywords.                                                      |
| `style`    | string                | Named article style applied by the theme.                          |

### `meta.aiGen` — AI involvement disclosure

When an AI agent (Claude Code, Codex, a custom mxs caller, etc.) contributed to
a post / note / page, set `meta.aiGen` so the frontend can render the disclosure
badge. The value is a single preset number, or an array of preset numbers when
multiple kinds of AI involvement apply. Exclusive values (`-1` handmade, `2`
fully AI-generated) must not be combined with anything else.

| Value | Label                       | Exclusive |
| ----- | --------------------------- | --------- |
| `-1`  | No AI (handcrafted)         | yes       |
| `0`   | Writing assistance          | no        |
| `2`   | Fully AI-generated          | yes       |
| `3`   | Story organization          | no        |
| `4`   | Title generation            | no        |
| `8`   | AI-generated imagery        | no        |
| `9`   | Dictation                   | no        |

Legacy values `1` / `5` / `6` / `7` have been merged into `0` (assist) on the
frontend; read-side compatibility is kept but new content should use `0`.

Setting via the CLI:

```bash
# Fully AI-generated body.
mxs post create --file ./post.xml --meta '{"aiGen":2}' --json

# Mixed involvement: writing assistance + title generation.
mxs note create --file ./note.xml --meta '{"aiGen":[0,4]}' --json

# Merge from a JSON file.
mxs post update aws-vless --meta 'file=./meta.json' --json
```

Rules of thumb for agents:

- If you wrote the full body, set `aiGen: 2`.
- If you only refined wording, set `aiGen: 0` (or include `0` in the array).
- If a human authored the body and you only patched metadata (title, tags,
  summary), do **not** set `aiGen` — leave the field untouched.
- If `meta.aiGen` is already set and you only patch unrelated fields, preserve
  the existing value; do not strip it.
- Prefer the camelCase key `aiGen`. The frontend also accepts legacy `ai_gen`
  for backward compatibility, but new writes must use `aiGen`.

## Read-back verification

| Resource | Minimum read-back checks                                                                |
| -------- | --------------------------------------------------------------------------------------- |
| Post     | `title`, `slug`, `state`, category, tags, summary, representative body text.            |
| Note     | `title`, `slug` or `nid`, `state`, topic, metadata fields, representative body text.    |
| Page     | `title`, `slug`, `subtitle`, `order`, representative body text.                         |

Prefer `--output llm` for low-noise body inspection and `--json` for strict field checks.
