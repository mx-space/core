# Content Authoring

Use this reference when drafting or modifying posts, notes, or pages.

## Resource Selection

| Resource | Association | Publish Commands | Envelope Root |
| --- | --- | --- | --- |
| Post | Category | `post publish`, `post unpublish` | `<mxpost>` |
| Note | Topic | `note publish`, `note unpublish` | `<mxnote>` |
| Page | none | no dedicated publish command | `<mxpost>` |

## Preferred Drafting Sequence

```text
┌─────────────────────────┐
│ Resolve category/topic  │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Write LiteXML envelope  │
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

## Content Sources

| Spec | Meaning |
| --- | --- |
| `--content="inline literal"` | Use the argument as body text. |
| `--content=file=<path>` | Read body content from a file. |
| `--content=-` | Read body content from stdin. |
| `--content=stdin` | Read body content from stdin. |
| `--file <path>` | Read a LiteXML envelope with metadata and body. |
| `--file -` | Read a LiteXML envelope from stdin. |

`--meta`, `--images`, and comparable JSON fields accept either an inline JSON literal or `file=<path>`.

## Format Rules

| Format | Behavior |
| --- | --- |
| `lexical` | Default. LiteXML is parsed through `@haklex/rich-litexml` and stored as Lexical JSON; derived plain text is also sent. |
| `markdown` | Content is sent as markdown text without Lexical conversion. |

For `lexical`, empty content is invalid when a content source is provided.

## Flag And Envelope Precedence

| Rule | Consequence |
| --- | --- |
| CLI flags override envelope metadata. | Use flags for last-mile corrections such as `--state draft`. |
| `update` preserves body when neither `--content` nor `--file` is supplied. | Use partial updates for metadata-only changes. |
| `edit` invokes `$EDITOR` when no content flags are supplied. | Avoid in non-interactive agent workflows unless explicitly requested. |
| Page file payloads use the post envelope parser. | Use `<mxpost>` for page envelopes. |

## Existing Lexical Content With Rich Nodes

Do not blindly round-trip an existing Lexical document through `--output envelope` and `post update --file` when it contains links, embeds, or other rich nodes. A dry-run must prove that URLs and node-specific attributes survive conversion. If dry-run output shows empty link URLs or empty embed URLs, stop before writing; otherwise the update can silently damage the article structure.

When only the body needs to change, prefer `post update --content - --format lexical` with the extracted `<content>` body instead of `--file`; this avoids unintentionally patching envelope metadata such as tags or category.

## Post Envelope

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

## Note Envelope

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

## Page Envelope

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

Common commands:

```bash
mxs page create --file ./page.xml --json
mxs page update about --subtitle "Updated subtitle" --json
mxs page get about --output llm
```

## Read-Back Verification

| Resource | Minimum Read-Back Checks |
| --- | --- |
| Post | `title`, `slug`, `state`, category, tags, summary, representative body text. |
| Note | `title`, `slug` or `nid`, `state`, topic, metadata fields, representative body text. |
| Page | `title`, `slug`, `subtitle`, `order`, representative body text. |

Prefer `--output llm` for low-noise body inspection and `--json` for strict field checks.
