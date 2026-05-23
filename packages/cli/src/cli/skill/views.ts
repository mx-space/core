import type { View } from '../../services/Renderer/view'
import type { Chapter, SearchHit } from '../../services/Skill'
import { renderMarkdownToAnsi } from '../render'
import { ANSI, dim, renderTable, wrap } from '../ui'

const xmlEscape = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export const skillListView: View<readonly Chapter[]> = {
  kind: 'skill-list',
  modes: new Set(['readable', 'llm', 'xml']),
  readable: (chapters, { color }) => {
    if (chapters.length === 0) return dim('no chapters loaded', color)
    return renderTable(
      [
        { key: 'slug', label: 'slug' },
        { key: 'title', label: 'title' },
        { key: 'description', label: 'description' },
        { key: 'source', label: 'src' },
      ],
      chapters.map((c) => ({
        slug: wrap(ANSI.bold, c.slug, color),
        title: c.title,
        description: c.description,
        source: c.source === 'haklex' ? dim('haklex', color) : 'cli',
      })),
      { color },
    )
  },
  llm: (chapters) =>
    chapters.map((c) => `${c.slug}\t${c.description}`).join('\n'),
  xml: (chapters) => {
    const inner = chapters
      .map(
        (c) =>
          `  <chapter slug="${xmlEscape(c.slug)}" title="${xmlEscape(c.title)}" description="${xmlEscape(c.description)}" source="${c.source}" />`,
      )
      .join('\n')
    return `<chapters>\n${inner}\n</chapters>`
  },
}

const renderChapterReadable = (chapter: Chapter, color: boolean): string => {
  const header = `# ${chapter.title}\n\n_${chapter.description}_\n\n`
  return renderMarkdownToAnsi(header + chapter.body, { color }).trimEnd()
}

export const skillChapterView: View<Chapter> = {
  kind: 'skill-chapter',
  modes: new Set(['readable', 'llm', 'xml']),
  readable: (chapter, { color }) => renderChapterReadable(chapter, color),
  llm: (chapter) => chapter.body.trimEnd(),
  xml: (chapter) =>
    `<chapter slug="${xmlEscape(chapter.slug)}" title="${xmlEscape(chapter.title)}" source="${chapter.source}">\n${chapter.body.trimEnd()}\n</chapter>`,
}

export const skillAllView: View<readonly Chapter[]> = {
  kind: 'skill-all',
  modes: new Set(['readable', 'llm', 'xml']),
  readable: (chapters, { color }) =>
    chapters.map((c) => renderChapterReadable(c, color)).join('\n\n'),
  llm: (chapters) =>
    chapters
      .map((c) => `# ${c.title} (${c.slug})\n\n${c.body.trimEnd()}`)
      .join('\n\n---\n\n'),
  xml: (chapters) => {
    const inner = chapters
      .map(
        (c) =>
          `<chapter slug="${xmlEscape(c.slug)}" title="${xmlEscape(c.title)}" source="${c.source}">\n${c.body.trimEnd()}\n</chapter>`,
      )
      .join('\n')
    return `<chapters>\n${inner}\n</chapters>`
  },
}

export const skillSearchView: View<readonly SearchHit[]> = {
  kind: 'skill-search',
  modes: new Set(['readable', 'llm', 'xml']),
  readable: (hits, { color }) => {
    if (hits.length === 0) return dim('no matches', color)
    const lines: string[] = []
    for (const h of hits) {
      lines.push(`${wrap(ANSI.bold, h.slug, color)} — ${h.title}`)
      lines.push(`  ${dim(h.description, color)}`)
      for (const snippet of h.snippets) {
        lines.push(`  ${snippet}`)
      }
      lines.push('')
    }
    return lines.join('\n').trimEnd()
  },
  llm: (hits) =>
    hits
      .map((h) =>
        [`# ${h.title} (${h.slug})`, h.description, '', ...h.snippets].join(
          '\n',
        ),
      )
      .join('\n\n---\n\n'),
  xml: (hits) => {
    const inner = hits
      .map((h) => {
        const snippets = h.snippets
          .map((s) => `    <snippet>${xmlEscape(s)}</snippet>`)
          .join('\n')
        return `  <hit slug="${xmlEscape(h.slug)}" title="${xmlEscape(h.title)}">\n${snippets}\n  </hit>`
      })
      .join('\n')
    return `<hits>\n${inner}\n</hits>`
  },
}
