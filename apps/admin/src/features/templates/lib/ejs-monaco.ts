import * as monaco from 'monaco-editor'

export const EJS_HTML_LANGUAGE_ID = 'ejs-html'

let registered = false
let propsKeysProvider: () => string[] = () => []

export function setPropsKeysProvider(provider: () => string[]) {
  propsKeysProvider = provider
}

export function ensureEjsHtmlRegistered() {
  if (registered) return
  registered = true

  monaco.languages.register({ id: EJS_HTML_LANGUAGE_ID })

  monaco.languages.setMonarchTokensProvider(EJS_HTML_LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.ejs.html',

    tokenizer: {
      root: [
        [/<%#/, { token: 'comment.ejs', next: '@ejsComment' }],
        [/<%[-=_]?/, { token: 'metatag.ejs', next: '@ejsExpression' }],
        [/<!DOCTYPE/, { token: 'metatag.html', next: '@doctype' }],
        [/<!--/, { token: 'comment.html', next: '@comment' }],
        [
          /(<)((?:[\w-]+))/,
          ['delimiter.html', { token: 'tag.html', next: '@otherTag' }],
        ],
        [
          /(<\/)((?:[\w-]+))/,
          ['delimiter.html', { token: 'tag.html', next: '@otherTag' }],
        ],
        [/&\w+;/, 'string.escape'],
      ],

      doctype: [
        [/[^>]+/, 'metatag.content.html'],
        [/>/, 'metatag.html', '@pop'],
      ],

      comment: [
        [/-->/, 'comment.html', '@pop'],
        [/[^-]+/, 'comment.content.html'],
        [/./, 'comment.content.html'],
      ],

      ejsComment: [
        [/%>/, { token: 'comment.ejs', next: '@pop' }],
        [/[^%]+/, 'comment.content.ejs'],
        [/./, 'comment.content.ejs'],
      ],

      ejsExpression: [
        [/[-_]?%>/, { token: 'metatag.ejs', next: '@pop' }],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.ejs', next: '@stringDouble' }],
        [/'/, { token: 'string.ejs', next: '@stringSingle' }],
        [
          /\b(?:if|else|for|while|do|switch|case|break|return|var|let|const|function|new|in|of|typeof|true|false|null|undefined)\b/,
          'keyword.ejs',
        ],
        [/\d+(\.\d+)?/, 'number.ejs'],
        [/[a-zA-Z_$][\w$]*/, 'identifier.ejs'],
        [/[+\-*/%=<>!&|^~?:.,;()[\]{}]/, 'delimiter.ejs'],
      ],

      stringDouble: [
        [/[^\\"]+/, 'string.ejs'],
        [/\\./, 'string.escape.ejs'],
        [/"/, { token: 'string.ejs', next: '@pop' }],
      ],

      stringSingle: [
        [/[^\\']+/, 'string.ejs'],
        [/\\./, 'string.escape.ejs'],
        [/'/, { token: 'string.ejs', next: '@pop' }],
      ],

      otherTag: [
        [/\/?>/, 'delimiter.html', '@pop'],
        [/"([^"]*)"/, 'attribute.value.html'],
        [/'([^']*)'/, 'attribute.value.html'],
        [/[\w-]+/, 'attribute.name.html'],
        [/=/, 'delimiter.html'],
      ],
    },
  })

  monaco.languages.setLanguageConfiguration(EJS_HTML_LANGUAGE_ID, {
    comments: {
      blockComment: ['<!--', '-->'],
    },
    brackets: [
      ['<', '>'],
      ['{', '}'],
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '<%', close: ' %>' },
      { open: '<%=', close: ' %>' },
      { open: '<%-', close: ' %>' },
      { open: '<', close: '>' },
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '<', close: '>' },
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  })

  monaco.languages.registerCompletionItemProvider(EJS_HTML_LANGUAGE_ID, {
    triggerCharacters: ['%', '=', '.', ' '],
    provideCompletionItems(model, position) {
      const lineText = model.getLineContent(position.lineNumber)
      const upToCursor = lineText.slice(0, position.column - 1)

      const lastOpen = upToCursor.lastIndexOf('<%')
      const lastClose = upToCursor.lastIndexOf('%>')
      const insideEjs = lastOpen >= 0 && lastOpen > lastClose

      if (!insideEjs) {
        return { suggestions: [] }
      }

      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const keys = propsKeysProvider()
      const suggestions: monaco.languages.CompletionItem[] = keys.map(
        (key) => ({
          label: key,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: key,
          range,
          detail: 'sample prop',
        }),
      )

      return { suggestions }
    },
  })
}

export function flattenPropsKeys(value: unknown, prefix = ''): string[] {
  if (value == null) return []
  if (typeof value !== 'object') return prefix ? [prefix] : []
  if (Array.isArray(value)) return prefix ? [prefix] : []

  const keys: string[] = []
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(path, ...flattenPropsKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}
