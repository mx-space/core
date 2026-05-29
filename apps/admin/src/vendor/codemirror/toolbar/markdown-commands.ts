import type { ChangeSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type InlineFormat = 'bold' | 'italic' | 'strikethrough' | 'inlineCode'

interface InlineMatch {
  start: number
  end: number
  contentStart: number
  contentEnd: number
  markerStart: string
  markerEnd: string
}

const findInlineMatches = (
  lineText: string,
  lineFrom: number,
  format: InlineFormat,
): InlineMatch[] => {
  const matches: InlineMatch[] = []
  let match: RegExpExecArray | null

  if (format === 'inlineCode') {
    const regex = /`([^`]+)`/g
    while ((match = regex.exec(lineText)) !== null) {
      const start = lineFrom + match.index
      const end = start + match[0].length
      matches.push({
        start,
        end,
        contentStart: start + 1,
        contentEnd: end - 1,
        markerStart: '`',
        markerEnd: '`',
      })
    }
    return matches
  }

  if (format === 'bold') {
    const regex = /(\*\*|__)(?!\s)(.+?)(?<!\s)\1/g
    while ((match = regex.exec(lineText)) !== null) {
      const marker = match[1]
      const start = lineFrom + match.index
      const end = start + match[0].length
      matches.push({
        start,
        end,
        contentStart: start + marker.length,
        contentEnd: end - marker.length,
        markerStart: marker,
        markerEnd: marker,
      })
    }
    return matches
  }

  if (format === 'strikethrough') {
    const regex = /~~(?!\s)(.+?)(?<!\s)~~/g
    while ((match = regex.exec(lineText)) !== null) {
      const start = lineFrom + match.index
      const end = start + match[0].length
      matches.push({
        start,
        end,
        contentStart: start + 2,
        contentEnd: end - 2,
        markerStart: '~~',
        markerEnd: '~~',
      })
    }
    return matches
  }

  if (format === 'italic') {
    const regex =
      /(?<!\*)\*(?!\*)(?!\s)([^*]+?)(?<!\s)\*(?!\*)|(?<!_)_(?!_)(?!\s)([^_]+?)(?<!\s)_(?!_)/g
    while ((match = regex.exec(lineText)) !== null) {
      const marker = match[0].startsWith('*') ? '*' : '_'
      const start = lineFrom + match.index
      const end = start + match[0].length
      matches.push({
        start,
        end,
        contentStart: start + 1,
        contentEnd: end - 1,
        markerStart: marker,
        markerEnd: marker,
      })
    }
  }

  return matches
}

const getInlineMatchForSelection = (
  view: EditorView,
  format: InlineFormat,
): InlineMatch | null => {
  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  if (startLine.number !== endLine.number) return null

  const matches = findInlineMatches(startLine.text, startLine.from, format)
  return (
    matches.find(
      (matchItem) => from >= matchItem.start && to <= matchItem.end,
    ) ?? null
  )
}

export const isInlineFormatActive = (
  view: EditorView,
  format: InlineFormat,
): boolean => {
  return Boolean(getInlineMatchForSelection(view, format))
}

function wrapSelection(
  view: EditorView,
  before: string,
  after: string = before,
  placeholder: string = '',
  format?: InlineFormat,
): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.sliceDoc(from, to)

  if (format) {
    const match = getInlineMatchForSelection(view, format)
    if (match) {
      const contentLength = match.contentEnd - match.contentStart

      view.dispatch({
        changes: [
          { from: match.start, to: match.contentStart, insert: '' },
          { from: match.contentEnd, to: match.end, insert: '' },
        ],
        selection: {
          anchor: match.start,
          head: match.start + contentLength,
        },
      })

      view.focus()
      return true
    }
  }

  const text = selectedText || placeholder
  const insert = `${before}${text}${after}`

  view.dispatch({
    changes: { from, to, insert },
    selection: {
      anchor: from + before.length,
      head: from + before.length + text.length,
    },
  })

  view.focus()
  return true
}

function insertAtLineStart(
  view: EditorView,
  prefix: string,
  toggle: boolean = true,
): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const firstLine = state.doc.lineAt(from)
  const lastLine = state.doc.lineAt(to)

  if (firstLine.number === lastLine.number || from === to) {
    const lineText = firstLine.text

    if (toggle && lineText.startsWith(prefix)) {
      view.dispatch({
        changes: {
          from: firstLine.from,
          to: firstLine.from + prefix.length,
          insert: '',
        },
      })
    } else {
      view.dispatch({
        changes: {
          from: firstLine.from,
          to: firstLine.from,
          insert: prefix,
        },
      })
    }
  } else {
    const indent = ' '.repeat(prefix.length)
    const changes: ChangeSpec[] = []

    for (let i = firstLine.number; i <= lastLine.number; i++) {
      const line = state.doc.line(i)
      const linePrefix = i === firstLine.number ? prefix : indent
      changes.push({
        from: line.from,
        to: line.from,
        insert: linePrefix,
      })
    }

    view.dispatch({ changes })
  }

  view.focus()
  return true
}

function insertBlock(
  view: EditorView,
  template: string,
  cursorOffset: number = 0,
): boolean {
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)

  const insertPos = line.to
  const needsNewline = line.text.length > 0
  const insert = (needsNewline ? '\n' : '') + template

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert },
    selection: {
      anchor: insertPos + insert.length + cursorOffset,
    },
  })

  view.focus()
  return true
}

export const setHeadingLevel = (view: EditorView, level: number): boolean => {
  const normalizedLevel = Math.min(6, Math.max(1, level))
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const lineText = line.text
  const prefix = `${'#'.repeat(normalizedLevel)} `
  const match = lineText.match(/^(#{1,6})\s/)

  if (match) {
    view.dispatch({
      changes: {
        from: line.from,
        to: line.from + match[0].length,
        insert: prefix,
      },
    })
  } else {
    view.dispatch({
      changes: {
        from: line.from,
        to: line.from,
        insert: prefix,
      },
    })
  }

  view.focus()
  return true
}

export const commands = {
  bold: (view: EditorView) =>
    wrapSelection(view, '**', '**', '粗体文本', 'bold'),
  italic: (view: EditorView) =>
    wrapSelection(view, '*', '*', '斜体文本', 'italic'),
  strikethrough: (view: EditorView) =>
    wrapSelection(view, '~~', '~~', '删除文本', 'strikethrough'),
  inlineCode: (view: EditorView) =>
    wrapSelection(view, '`', '`', 'code', 'inlineCode'),
  codeBlock: (view: EditorView) => {
    const { state } = view
    const { from, to } = state.selection.main
    const selectedText = state.sliceDoc(from, to)

    if (selectedText) {
      const insert = `\`\`\`\n${selectedText}\n\`\`\``

      view.dispatch({
        changes: { from, to, insert },
        selection: {
          anchor: from + 4,
          head: from + 4,
        },
      })
    } else {
      const template = `\n\`\`\`javascript\n// 代码\n\`\`\`\n`
      return insertBlock(view, template, -18)
    }

    view.focus()
    return true
  },

  link: (view: EditorView) => {
    const { state } = view
    const { from, to } = state.selection.main
    const selectedText = state.sliceDoc(from, to)

    const text = selectedText || '链接文本'
    const insert = `[${text}](https://)`

    view.dispatch({
      changes: { from, to, insert },
      selection: {
        anchor: from + insert.length - 1,
      },
    })

    view.focus()
    return true
  },

  heading: (view: EditorView) => {
    const { state } = view
    const line = state.doc.lineAt(state.selection.main.from)
    const lineText = line.text

    const match = lineText.match(/^(#{1,6})\s/)

    if (match) {
      const currentLevel = match[1].length
      const nextLevel = currentLevel >= 6 ? 1 : currentLevel + 1
      const newPrefix = `${'#'.repeat(nextLevel)} `

      view.dispatch({
        changes: {
          from: line.from,
          to: line.from + match[0].length,
          insert: newPrefix,
        },
      })
    } else {
      insertAtLineStart(view, '# ', false)
    }

    view.focus()
    return true
  },

  bulletList: (view: EditorView) => insertAtLineStart(view, '- '),
  orderedList: (view: EditorView) => {
    const { state } = view
    const line = state.doc.lineAt(state.selection.main.from)

    let prevNumber = 1
    if (line.number > 1) {
      const prevLine = state.doc.line(line.number - 1)
      const match = prevLine.text.match(/^(\d+)\.\s/)
      if (match) {
        prevNumber = parseInt(match[1]) + 1
      }
    }

    return insertAtLineStart(view, `${prevNumber}. `, false)
  },

  taskList: (view: EditorView) => insertAtLineStart(view, '- [ ] '),
  quote: (view: EditorView) => {
    const { state } = view
    const { from, to } = state.selection.main
    const firstLine = state.doc.lineAt(from)
    const lastLine = state.doc.lineAt(to)

    if (firstLine.number !== lastLine.number && from !== to) {
      const changes: ChangeSpec[] = []

      for (let i = firstLine.number; i <= lastLine.number; i++) {
        const line = state.doc.line(i)
        changes.push({
          from: line.from,
          to: line.from,
          insert: '> ',
        })
      }

      view.dispatch({ changes })
      view.focus()
      return true
    }

    return insertAtLineStart(view, '> ')
  },
  horizontalRule: (view: EditorView) => insertBlock(view, '\n---\n', 0),
  emoji: (view: EditorView, emoji: string) => {
    const { state } = view
    const { from } = state.selection.main

    view.dispatch({
      changes: { from, to: from, insert: emoji },
      selection: { anchor: from + emoji.length },
    })

    view.focus()
    return true
  },

  // managed by historyKeymap
  undo: (_view: EditorView) => {
    return true
  },
  redo: (_view: EditorView) => {
    return true
  },
}

export type CommandName = keyof typeof commands
