// ---------------------------------------------------------------------------
// Minimal terminal syntax highlighter.
//
// Same philosophy as `./markdown.ts`: hand-rolled to avoid pulling in
// `cli-highlight` / `highlight.js` (~270 KB). Covers js/ts, jsx/tsx,
// bash/sh/zsh, json, css, html/xml, python — the languages most often seen
// in blog posts. Anything else falls through to a generic ruleset that
// highlights strings, numbers, and line comments.
// ---------------------------------------------------------------------------

import { ANSI, wrap } from './markdown'

type ColorKey = keyof typeof ANSI

interface Rule {
  readonly pattern: RegExp
  readonly color: ColorKey
}

interface LangSet {
  // Literals (strings + comments) — extracted first so keyword rules don't
  // recurse into them.
  readonly literals: readonly Rule[]
  // Token rules applied to the post-literal text.
  readonly tokens: readonly Rule[]
}

// Common shared rules.
const STRING_DOUBLE_OR_SINGLE: Rule = {
  pattern: /(["'])(?:\\.|(?!\1)[^\n\\])*\1/g,
  color: 'green',
}
const STRING_TEMPLATE: Rule = {
  pattern: /`(?:\\.|[^\\`])*`/g,
  color: 'green',
}
const LINE_COMMENT_DSLASH: Rule = {
  pattern: /\/\/[^\n]*/g,
  color: 'dim',
}
const LINE_COMMENT_HASH: Rule = {
  pattern: /(^|\s)#[^\n]*/g,
  color: 'dim',
}
const BLOCK_COMMENT_C: Rule = {
  pattern: /\/\*[\s\S]*?\*\//g,
  color: 'dim',
}
const NUMBERS: Rule = {
  pattern: /\b\d+(?:\.\d+)?\b/g,
  color: 'yellow',
}

const kw = (words: readonly string[]): RegExp =>
  new RegExp(`\\b(?:${words.join('|')})\\b`, 'g')

const JS_KEYWORDS = [
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'default',
  'class',
  'extends',
  'super',
  'this',
  'new',
  'typeof',
  'instanceof',
  'in',
  'of',
  'import',
  'export',
  'from',
  'as',
  'async',
  'await',
  'yield',
  'try',
  'catch',
  'finally',
  'throw',
  'void',
  'delete',
  'interface',
  'type',
  'enum',
  'implements',
  'public',
  'private',
  'protected',
  'readonly',
  'static',
  'declare',
  'abstract',
  'namespace',
  'module',
  'require',
]
const JS_LITERALS = ['true', 'false', 'null', 'undefined']

const JS_SET: LangSet = {
  // Strings must extract before comments so `"a // b"` keeps its `//`.
  literals: [
    STRING_TEMPLATE,
    STRING_DOUBLE_OR_SINGLE,
    BLOCK_COMMENT_C,
    LINE_COMMENT_DSLASH,
  ],
  tokens: [
    { pattern: kw(JS_KEYWORDS), color: 'magenta' },
    { pattern: kw(JS_LITERALS), color: 'yellow' },
    NUMBERS,
  ],
}

const SHELL_KEYWORDS = [
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'case',
  'esac',
  'for',
  'while',
  'do',
  'done',
  'in',
  'function',
  'return',
  'exit',
  'export',
  'local',
  'readonly',
  'unset',
  'echo',
  'printf',
  'cd',
  'set',
  'source',
]

const SHELL_SET: LangSet = {
  literals: [STRING_DOUBLE_OR_SINGLE, LINE_COMMENT_HASH],
  tokens: [
    { pattern: kw(SHELL_KEYWORDS), color: 'magenta' },
    // Long and short flags (-x, --foo).
    { pattern: /(?<=\s)-[\w-]+/g, color: 'cyan' },
    NUMBERS,
  ],
}

const JSON_SET: LangSet = {
  literals: [STRING_DOUBLE_OR_SINGLE],
  tokens: [{ pattern: /\b(?:true|false|null)\b/g, color: 'yellow' }, NUMBERS],
}

const CSS_SET: LangSet = {
  literals: [STRING_DOUBLE_OR_SINGLE, BLOCK_COMMENT_C],
  tokens: [
    { pattern: /@[a-z-]+/g, color: 'magenta' },
    { pattern: /#[\da-f]{3,8}\b/gi, color: 'yellow' },
    {
      pattern: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|deg|s|ms)?\b/g,
      color: 'yellow',
    },
    { pattern: /[a-z-]+(?=\s*:)/g, color: 'cyan' },
  ],
}

const HTML_SET: LangSet = {
  literals: [
    { pattern: /<!--[\s\S]*?-->/g, color: 'dim' },
    STRING_DOUBLE_OR_SINGLE,
  ],
  tokens: [
    { pattern: /<\/?[\w-]+/g, color: 'magenta' },
    { pattern: /\b[\w-]+(?==)/g, color: 'cyan' },
  ],
}

const PYTHON_KEYWORDS = [
  'def',
  'class',
  'if',
  'elif',
  'else',
  'for',
  'while',
  'return',
  'yield',
  'import',
  'from',
  'as',
  'try',
  'except',
  'finally',
  'raise',
  'with',
  'pass',
  'break',
  'continue',
  'lambda',
  'global',
  'nonlocal',
  'in',
  'is',
  'not',
  'and',
  'or',
  'async',
  'await',
]

const PYTHON_SET: LangSet = {
  literals: [STRING_DOUBLE_OR_SINGLE, LINE_COMMENT_HASH],
  tokens: [
    { pattern: kw(PYTHON_KEYWORDS), color: 'magenta' },
    { pattern: /\b(?:True|False|None)\b/g, color: 'yellow' },
    NUMBERS,
  ],
}

const DEFAULT_SET: LangSet = {
  literals: [STRING_DOUBLE_OR_SINGLE, LINE_COMMENT_DSLASH, LINE_COMMENT_HASH],
  tokens: [NUMBERS],
}

const LANG_TABLE: Record<string, LangSet> = {
  js: JS_SET,
  jsx: JS_SET,
  ts: JS_SET,
  tsx: JS_SET,
  javascript: JS_SET,
  typescript: JS_SET,
  mjs: JS_SET,
  cjs: JS_SET,
  bash: SHELL_SET,
  sh: SHELL_SET,
  shell: SHELL_SET,
  zsh: SHELL_SET,
  console: SHELL_SET,
  json: JSON_SET,
  jsonc: JSON_SET,
  css: CSS_SET,
  scss: CSS_SET,
  sass: CSS_SET,
  less: CSS_SET,
  html: HTML_SET,
  xml: HTML_SET,
  svg: HTML_SET,
  py: PYTHON_SET,
  python: PYTHON_SET,
}

/**
 * Highlight a multi-line code block. `lang` is matched case-insensitively;
 * unknown values fall through to a conservative default ruleset.
 *
 * When `color` is false (NO_COLOR / non-TTY), the input is returned verbatim
 * so callers don't have to short-circuit themselves.
 */
export const highlightCode = (
  code: string,
  lang: string | undefined,
  color: boolean,
): string => {
  if (!color) return code
  const key = (lang ?? '').toLowerCase().trim()
  const set = LANG_TABLE[key] ?? DEFAULT_SET

  const stash: string[] = []
  let work = code
  // Placeholder format: `\x00ph<idx>\x00`. The leading `ph` letters break
  // word-boundary so a later `\b\d+\b` rule can't match the index digits.
  for (const rule of set.literals) {
    work = work.replaceAll(rule.pattern, (match) => {
      const placeholder = `\x00ph${stash.length}\x00`
      stash.push(wrap(ANSI[rule.color], match, true))
      return placeholder
    })
  }
  for (const rule of set.tokens) {
    work = work.replaceAll(rule.pattern, (match) =>
      wrap(ANSI[rule.color], match, true),
    )
  }
  work = work.replaceAll(/\0ph(\d+)\0/g, (_, idx: string) => stash[Number(idx)])
  return work
}
