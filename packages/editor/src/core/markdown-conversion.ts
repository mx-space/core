import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import {
  $convertFromMarkdownString,
  CHECK_LIST,
  type TextFormatTransformer,
  TRANSFORMERS,
} from '@lexical/markdown'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

import { mxLexicalToMarkdown } from './markdown'
import type { SerializedMxEditorState } from './types'

export const MX_MARKDOWN_CONVERTER_VERSION = '0.1.0'

export type MarkdownConversionProfile = 'yohaku-v1'

export interface MarkdownSourcePosition {
  line: number
  column: number
  offset: number
}

export interface MarkdownSourceRange {
  start: MarkdownSourcePosition
  end: MarkdownSourcePosition
}

export interface MarkdownConversionIssue {
  code: string
  feature: string
  message: string
  range: MarkdownSourceRange
  severity: 'blocking'
  details?: Record<string, unknown>
}

export interface MarkdownFeatureOccurrence {
  feature: string
  range: MarkdownSourceRange
  targetNode?: string
}

export type MarkdownConversionResult =
  | {
      status: 'convertible'
      converterVersion: string
      profile: MarkdownConversionProfile
      sourceHash: string
      features: MarkdownFeatureOccurrence[]
      content: SerializedMxEditorState
      text: string
    }
  | {
      status: 'blocked'
      converterVersion: string
      profile: MarkdownConversionProfile
      sourceHash: string
      features: MarkdownFeatureOccurrence[]
      issues: MarkdownConversionIssue[]
    }

export interface AnalyzeMxMarkdownOptions {
  profile: MarkdownConversionProfile
  blockIdFactory?: (path: string) => string
}

interface SourceSpan {
  start: number
  end: number
}

interface SourceLine extends SourceSpan {
  index: number
  text: string
  fullEnd: number
}

interface SerializedNode {
  type?: string
  children?: SerializedNode[]
  text?: string
  format?: unknown
  [key: string]: unknown
}

interface SourceReplacement extends SourceSpan {
  placeholder: string
  node: SerializedNode
  block: boolean
}

const INSERT_TRANSFORMER: TextFormatTransformer = {
  format: ['underline'],
  tag: '++',
  type: 'text-format',
}

const IMPORT_TRANSFORMERS = [CHECK_LIST, INSERT_TRANSFORMER, ...TRANSFORMERS]
const INLINE_CODE_FORMAT = 1 << 4

function sourceHash(markdown: string): string {
  return `sha256:${bytesToHex(sha256(utf8ToBytes(markdown)))}`
}

function getLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  let start = 0
  let index = 0

  while (start <= source.length) {
    const newline = source.indexOf('\n', start)
    const fullEnd = newline === -1 ? source.length : newline + 1
    let end = newline === -1 ? source.length : newline
    if (end > start && source[end - 1] === '\r') end--
    lines.push({
      start,
      end,
      fullEnd,
      index,
      text: source.slice(start, end),
    })
    index++
    if (newline === -1) break
    start = newline + 1
  }

  return lines
}

function getLineStarts(lines: SourceLine[]): number[] {
  return lines.map((line) => line.start)
}

function positionAt(
  source: string,
  lineStarts: number[],
  rawOffset: number,
): MarkdownSourcePosition {
  const offset = Math.max(0, Math.min(rawOffset, source.length))
  let low = 0
  let high = lineStarts.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lineStarts[middle] <= offset) low = middle + 1
    else high = middle - 1
  }

  const lineIndex = Math.max(0, high)
  return {
    line: lineIndex + 1,
    column: offset - lineStarts[lineIndex] + 1,
    offset,
  }
}

function toRange(
  source: string,
  lineStarts: number[],
  span: SourceSpan,
): MarkdownSourceRange {
  return {
    start: positionAt(source, lineStarts, span.start),
    end: positionAt(source, lineStarts, span.end),
  }
}

function overlaps(a: SourceSpan, b: SourceSpan): boolean {
  return a.start < b.end && b.start < a.end
}

function isCovered(span: SourceSpan, ignored: SourceSpan[]): boolean {
  return ignored.some((candidate) => overlaps(span, candidate))
}

function cloneNode<T>(node: T): T {
  return structuredClone(node)
}

function parseFenceOpening(value: string): {
  fenceLength: number
  indentLength: number
  info: string
  marker: '`' | '~'
} | null {
  let indentLength = 0
  while (value[indentLength] === ' ' || value[indentLength] === '\t') {
    indentLength++
  }

  const marker = value[indentLength]
  if (marker !== '`' && marker !== '~') return null

  let fenceEnd = indentLength
  while (value[fenceEnd] === marker) fenceEnd++
  const fenceLength = fenceEnd - indentLength
  if (fenceLength < 3) return null

  return {
    fenceLength,
    indentLength,
    info: value.slice(fenceEnd).trim(),
    marker,
  }
}

function parseSingleLineKatex(value: string): string | null {
  let indentLength = 0
  while (value[indentLength] === ' ') indentLength++
  if (indentLength > 3) return null

  const content = value.slice(indentLength).trimEnd()
  if (
    content.length <= 4 ||
    !content.startsWith('$$') ||
    !content.endsWith('$$')
  ) {
    return null
  }
  return content.slice(2, -2).trim()
}

function isTableDivider(value: string): boolean {
  let content = value.trim()
  if (content.startsWith('|')) content = content.slice(1)
  if (content.endsWith('|')) content = content.slice(0, -1)

  const cells = content.split('|')
  return (
    cells.length >= 2 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()))
  )
}

function textNode(text: string, template?: SerializedNode): SerializedNode {
  return {
    detail: typeof template?.detail === 'number' ? template.detail : 0,
    format: typeof template?.format === 'number' ? template.format : 0,
    mode: typeof template?.mode === 'string' ? template.mode : 'normal',
    style: typeof template?.style === 'string' ? template.style : '',
    text,
    type: 'text',
    version: 1,
  }
}

function nestedTextNode(text: string): SerializedNode {
  return textNode(text)
}

function spoilerNode(text: string): SerializedNode {
  return {
    children: [nestedTextNode(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'spoiler',
    version: 1,
  }
}

function mentionNode(
  platform: string,
  handle: string,
  displayName?: string,
): SerializedNode {
  return {
    handle,
    platform,
    type: 'mention',
    version: 1,
    ...(displayName ? { displayName } : {}),
  }
}

function autoLinkNode(url: string, template?: SerializedNode): SerializedNode {
  return {
    children: [textNode(url, template)],
    direction: 'ltr',
    format: '',
    indent: 0,
    isUnlinked: false,
    rel: null,
    target: null,
    title: null,
    type: 'autolink',
    url,
    version: 1,
  }
}

function katexInlineNode(equation: string): SerializedNode {
  return { equation, type: 'katex-inline', version: 1 }
}

function katexBlockNode(equation: string): SerializedNode {
  return { equation, type: 'katex-block', version: 1 }
}

function imageNode(
  src: string,
  altText: string,
  caption?: string,
): SerializedNode {
  return {
    altText,
    src,
    type: 'image',
    version: 1,
    ...(caption ? { caption } : {}),
  }
}

function replacementText(
  source: string,
  replacement: SourceReplacement,
): string {
  if (!replacement.block) return replacement.placeholder
  const original = source.slice(replacement.start, replacement.end)
  const newlineCount = original.match(/\n/g)?.length ?? 0
  return replacement.placeholder + '\n'.repeat(newlineCount)
}

function applyReplacements(
  source: string,
  replacements: SourceReplacement[],
): string {
  let output = source
  const ordered = [...replacements].sort((a, b) => b.start - a.start)
  for (const replacement of ordered) {
    output =
      output.slice(0, replacement.start) +
      replacementText(source, replacement) +
      output.slice(replacement.end)
  }
  return output
}

function getSerializedState(markdown: string): SerializedMxEditorState {
  const editor = createHeadlessEditor({
    nodes: allHeadlessNodes,
    onError: (error) => {
      throw error
    },
  })

  editor.update(
    () => {
      $convertFromMarkdownString(
        markdown,
        IMPORT_TRANSFORMERS,
        undefined,
        false,
        true,
      )
    },
    { discrete: true },
  )

  return editor.getEditorState().toJSON() as SerializedMxEditorState
}

function nodeText(node: SerializedNode): string {
  if (node.type === 'text')
    return typeof node.text === 'string' ? node.text : ''
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'mention') {
    if (typeof node.displayName === 'string') return node.displayName
    return typeof node.handle === 'string' ? node.handle : ''
  }
  if (node.type === 'katex-inline' || node.type === 'katex-block') {
    return typeof node.equation === 'string' ? node.equation : ''
  }
  if (node.type === 'image') {
    if (typeof node.altText === 'string') return node.altText
    return typeof node.caption === 'string' ? node.caption : ''
  }
  if (node.type === 'code-block') {
    return typeof node.code === 'string' ? node.code : ''
  }
  if (!Array.isArray(node.children)) return ''

  const separator =
    node.type === 'root' || node.type === 'list' || node.type === 'listitem'
      ? '\n'
      : ''
  return node.children.map(nodeText).filter(Boolean).join(separator)
}

function findNextPlaceholder(
  value: string,
  placeholders: Map<string, SourceReplacement>,
): { index: number; replacement: SourceReplacement } | null {
  let result: { index: number; replacement: SourceReplacement } | null = null
  for (const [placeholder, replacement] of placeholders) {
    const index = value.indexOf(placeholder)
    if (index === -1 || (result && result.index <= index)) continue
    result = { index, replacement }
  }
  return result
}

function trimUrlPunctuation(raw: string): { url: string; suffix: string } {
  let url = raw
  let suffix = ''
  const punctuation = /[!,.:;?。！，：；？]$/

  while (punctuation.test(url)) {
    suffix = url.slice(-1) + suffix
    url = url.slice(0, -1)
  }

  while (url.endsWith(')')) {
    const opens = (url.match(/\(/g) ?? []).length
    const closes = (url.match(/\)/g) ?? []).length
    if (closes <= opens) break
    suffix = ')' + suffix
    url = url.slice(0, -1)
  }

  return { url, suffix }
}

function splitBareUrls(node: SerializedNode, value: string): SerializedNode[] {
  const format = typeof node.format === 'number' ? node.format : 0
  if (format & INLINE_CODE_FORMAT) return [textNode(value, node)]

  const output: SerializedNode[] = []
  const pattern = /https?:\/\/[^\s<>]+/g
  let cursor = 0

  for (const match of value.matchAll(pattern)) {
    const start = match.index
    if (start > cursor) output.push(textNode(value.slice(cursor, start), node))
    const { url, suffix } = trimUrlPunctuation(match[0])
    if (url) output.push(autoLinkNode(url, node))
    if (suffix) output.push(textNode(suffix, node))
    cursor = start + match[0].length
  }

  if (cursor < value.length) output.push(textNode(value.slice(cursor), node))
  return output.length > 0 ? output : [textNode(value, node)]
}

function applyInheritedTextFormat(
  replacement: SerializedNode,
  template: SerializedNode,
): SerializedNode {
  if (replacement.type !== 'spoiler' || !replacement.children?.length) {
    return replacement
  }
  const child = replacement.children[0]
  if (child.type !== 'text') return replacement
  child.format = typeof template.format === 'number' ? template.format : 0
  child.style = typeof template.style === 'string' ? template.style : ''
  return replacement
}

function postprocessTextNode(
  node: SerializedNode,
  placeholders: Map<string, SourceReplacement>,
  insideLink: boolean,
): SerializedNode[] {
  const value = typeof node.text === 'string' ? node.text : ''
  const output: SerializedNode[] = []
  let remaining = value

  while (remaining) {
    const next = findNextPlaceholder(remaining, placeholders)
    if (!next) {
      output.push(
        ...(insideLink
          ? [textNode(remaining, node)]
          : splitBareUrls(node, remaining)),
      )
      break
    }

    if (next.index > 0) {
      const prefix = remaining.slice(0, next.index)
      output.push(
        ...(insideLink
          ? [textNode(prefix, node)]
          : splitBareUrls(node, prefix)),
      )
    }

    if (next.replacement.block) {
      throw new Error('Block placeholder was imported inside a text node')
    }
    output.push(
      applyInheritedTextFormat(cloneNode(next.replacement.node), node),
    )
    remaining = remaining.slice(
      next.index + next.replacement.placeholder.length,
    )
  }

  return output.length > 0 ? output : [textNode('', node)]
}

function postprocessNode(
  node: SerializedNode,
  placeholders: Map<string, SourceReplacement>,
  insideLink = false,
): SerializedNode[] {
  if (node.type === 'text') {
    return postprocessTextNode(node, placeholders, insideLink)
  }

  if (node.type === 'code') {
    const code = Array.isArray(node.children)
      ? node.children.map(nodeText).join('')
      : ''
    const language = typeof node.language === 'string' ? node.language : ''
    if (language.toLowerCase() === 'mermaid') {
      return [{ diagram: code, type: 'mermaid', version: 1 }]
    }
    return [{ code, language, type: 'code-block', version: 1 }]
  }

  if (!Array.isArray(node.children)) return [node]
  const childInsideLink =
    insideLink || node.type === 'link' || node.type === 'autolink'
  return [
    {
      ...node,
      children: node.children.flatMap((child) =>
        postprocessNode(child, placeholders, childInsideLink),
      ),
    },
  ]
}

function postprocessState(
  state: SerializedMxEditorState,
  replacements: SourceReplacement[],
  blockIdFactory?: (path: string) => string,
): SerializedMxEditorState {
  const placeholders = new Map(
    replacements.map((replacement) => [replacement.placeholder, replacement]),
  )
  const root = state.root as SerializedNode
  const children = (root.children ?? []).flatMap((child) => {
    if (child.type === 'paragraph' && Array.isArray(child.children)) {
      const value = child.children.map(nodeText).join('')
      const replacement = placeholders.get(value)
      if (replacement?.block) return [cloneNode(replacement.node)]
    }
    return postprocessNode(child, placeholders)
  })

  if (blockIdFactory) {
    children.forEach((child, index) => {
      const blockId = blockIdFactory(`root.children[${index}]`).trim()
      if (!blockId) return
      const stateValue =
        child.$ && typeof child.$ === 'object' && !Array.isArray(child.$)
          ? (child.$ as Record<string, unknown>)
          : {}
      child.$ = { ...stateValue, blockId }
    })
  }

  return {
    root: {
      ...state.root,
      children,
    },
  }
}

function containsPlaceholder(
  node: SerializedNode,
  placeholders: Map<string, SourceReplacement>,
): boolean {
  if (node.type === 'text' && typeof node.text === 'string') {
    return [...placeholders.keys()].some((placeholder) =>
      node.text!.includes(placeholder),
    )
  }
  return (
    Array.isArray(node.children) &&
    node.children.some((child) => containsPlaceholder(child, placeholders))
  )
}

export function analyzeMxMarkdown(
  markdown: string,
  options: AnalyzeMxMarkdownOptions,
): MarkdownConversionResult {
  const hash = sourceHash(markdown)
  const lines = getLines(markdown)
  const lineStarts = getLineStarts(lines)
  const features: MarkdownFeatureOccurrence[] = []
  const issues: MarkdownConversionIssue[] = []
  const ignored: SourceSpan[] = []
  const replacements: SourceReplacement[] = []
  let placeholderIndex = 0

  const addFeature = (
    feature: string,
    span: SourceSpan,
    targetNode?: string,
  ) => {
    features.push({
      feature,
      range: toRange(markdown, lineStarts, span),
      ...(targetNode ? { targetNode } : {}),
    })
  }

  const addIssue = (
    code: string,
    feature: string,
    message: string,
    span: SourceSpan,
    details?: Record<string, unknown>,
  ) => {
    issues.push({
      code,
      feature,
      message,
      range: toRange(markdown, lineStarts, span),
      severity: 'blocking',
      ...(details ? { details } : {}),
    })
  }

  const createReplacement = (
    span: SourceSpan,
    node: SerializedNode,
    block: boolean,
  ) => {
    let placeholder: string
    do {
      placeholder = `MXMIGRATION${hash.slice(7, 19)}TOKEN${placeholderIndex++}`
    } while (markdown.includes(placeholder))
    const replacement = { ...span, placeholder, node, block }
    replacements.push(replacement)
    return replacement
  }

  // Fences are recognized first so their bodies cannot trigger syntax scans.
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const opening = parseFenceOpening(line.text)
    if (!opening) continue

    const { marker, fenceLength } = opening
    let closingIndex = -1
    const closingPattern = new RegExp(
      `^[ \\t]*${marker}{${fenceLength},}[ \\t]*$`,
    )
    for (let candidate = index + 1; candidate < lines.length; candidate++) {
      if (closingPattern.test(lines[candidate].text)) {
        closingIndex = candidate
        break
      }
    }

    const span = {
      start: line.start,
      end: closingIndex === -1 ? markdown.length : lines[closingIndex].fullEnd,
    }
    ignored.push(span)

    const { info } = opening
    addFeature(
      info.toLowerCase() === 'mermaid' ? 'mermaid' : 'code-fence',
      span,
      info.toLowerCase() === 'mermaid' ? 'mermaid' : 'code-block',
    )

    if (marker !== '`') {
      addIssue(
        'unsupported-fence-marker',
        'code-fence',
        'Tilde code fences are not yet supported by the Lexical importer.',
        span,
      )
    }
    if (opening.indentLength > 0) {
      addIssue(
        'unsupported-nested-code-fence',
        'code-fence',
        'Indented or nested code fences require structural-parent parity.',
        span,
      )
    }
    if (info && !/^[\w-]+$/.test(info)) {
      addIssue(
        'unsupported-code-fence-attributes',
        'code-fence-attributes',
        'Code-fence attributes cannot be represented without loss.',
        { start: line.start, end: line.end },
        { info },
      )
    }
    if (closingIndex === -1) {
      addIssue(
        'unclosed-code-fence',
        'code-fence',
        'The code fence is not closed.',
        span,
      )
      break
    }
    index = closingIndex
  }

  const lineIsIgnored = (line: SourceLine) => isCovered(line, ignored)

  // Block KaTeX is protected before inline-dollar analysis.
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (lineIsIgnored(line)) continue
    const oneLine = parseSingleLineKatex(line.text)
    if (oneLine !== null) {
      const span = { start: line.start, end: line.fullEnd }
      addFeature('katex-block', span, 'katex-block')
      createReplacement(span, katexBlockNode(oneLine), true)
      ignored.push(span)
      continue
    }
    if (!/^ {0,3}\$\$\s*$/.test(line.text)) continue

    let closingIndex = -1
    for (let candidate = index + 1; candidate < lines.length; candidate++) {
      if (/^ {0,3}\$\$\s*$/.test(lines[candidate].text)) {
        closingIndex = candidate
        break
      }
    }
    const span = {
      start: line.start,
      end: closingIndex === -1 ? markdown.length : lines[closingIndex].fullEnd,
    }
    addFeature('katex-block', span, 'katex-block')
    ignored.push(span)
    if (closingIndex === -1) {
      addIssue(
        'unclosed-katex-block',
        'katex-block',
        'The block KaTeX delimiter is not closed.',
        span,
      )
      break
    }
    const equation = markdown
      .slice(lines[index + 1].start, lines[closingIndex].start)
      .trim()
    if (!equation) {
      addIssue(
        'empty-katex-block',
        'katex-block',
        'An empty block KaTeX expression cannot be migrated.',
        span,
      )
    } else {
      createReplacement(span, katexBlockNode(equation), true)
    }
    index = closingIndex
  }

  // Standalone images map to the rich ImageNode. Other image shapes block.
  const imagePattern =
    // eslint-disable-next-line unicorn/better-regex -- Escaping the closing bracket keeps the expression valid in Unicode mode.
    /^ {0,3}!\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\)\s*$/
  for (const line of lines) {
    if (lineIsIgnored(line) || !line.text.includes('![')) continue
    const match = imagePattern.exec(line.text)
    const span = { start: line.start, end: line.fullEnd }
    if (!match) {
      addIssue(
        'unsupported-image-shape',
        'image',
        'Only standalone inline-destination images are currently supported.',
        span,
      )
      continue
    }
    const src = match[2] || match[3]
    const caption = match[4] || match[5] || match[6] || undefined
    addFeature('image', span, 'image')
    createReplacement(span, imageNode(src, match[1], caption), true)
    ignored.push(span)
  }

  // Horizontal rules need a dedicated node because Lexical's core importer
  // intentionally does not include a thematic-break transformer.
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (lineIsIgnored(line)) continue
    if (!/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.text)) continue

    const previous = index > 0 ? lines[index - 1] : undefined
    const isSetext =
      /^ {0,3}-{3,}\s*$/.test(line.text) &&
      previous !== undefined &&
      previous.text.trim() !== '' &&
      !lineIsIgnored(previous)
    const span = isSetext
      ? { start: previous.start, end: line.fullEnd }
      : { start: line.start, end: line.fullEnd }
    if (isSetext) {
      addFeature('setext-heading', span, 'heading')
      addIssue(
        'unsupported-heading-anchor-parity',
        'heading',
        'Heading migration is blocked until legacy Yohaku anchor IDs are preserved.',
        span,
      )
      ignored.push(span)
      continue
    }

    addFeature('horizontal-rule', span, 'horizontalrule')
    createReplacement(span, { type: 'horizontalrule', version: 1 }, true)
    ignored.push(span)
  }

  // Inline code is ignored by custom-token and unsupported-construct scans.
  const inlineCodePattern = /(`+)([^\n]*?)\1/g
  for (const match of markdown.matchAll(inlineCodePattern)) {
    const span = { start: match.index, end: match.index + match[0].length }
    if (!isCovered(span, ignored)) ignored.push(span)
  }

  // Structural constructs that are rendered by Markdown today but do not yet
  // have proven Lexical behavioral parity.
  for (const line of lines) {
    if (lineIsIgnored(line)) continue
    const span = { start: line.start, end: line.fullEnd }
    const container = /^\s*:::\s*([\w-]+)?/.exec(line.text)
    if (container && container[1]) {
      addFeature('container', span)
      addIssue(
        'unsupported-container',
        'container',
        `The ::: ${container[1]} container is not yet supported by the migration profile.`,
        span,
        { name: container[1] },
      )
    }

    const heading = /^ {0,3}(#{1,6})\s+/.exec(line.text)
    if (heading) {
      addFeature('atx-heading', span, 'heading')
      addIssue(
        'unsupported-heading-anchor-parity',
        'heading',
        'Heading migration is blocked until legacy Yohaku anchor IDs are preserved.',
        span,
        { level: heading[1].length },
      )
    }

    // eslint-disable-next-line unicorn/better-regex -- Escaping the closing bracket keeps the expression valid in Unicode mode.
    const alert = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(
      line.text,
    )
    if (alert) {
      addFeature('gfm-alert', span, 'alert-quote')
      addIssue(
        'unsupported-gfm-alert',
        'gfm-alert',
        'GFM alert migration requires nested-block renderer parity.',
        span,
        { type: alert[1].toLowerCase() },
      )
    } else if (/^\s*>\s*>/.test(line.text)) {
      addIssue(
        'unsupported-nested-blockquote',
        'blockquote',
        'Nested blockquotes are not yet represented without loss.',
        span,
      )
    } else if (/^\s*>\s*(?:[*+-] |\d+\. |```)/.test(line.text)) {
      addIssue(
        'unsupported-structured-blockquote',
        'blockquote',
        'Structured content nested inside a blockquote is not yet supported.',
        span,
      )
    }

    if (/^ {1,3}(?:[*+-] |\d+\. )/.test(line.text)) {
      addIssue(
        'unsupported-list-indentation',
        'list',
        'Nested list indentation must be a multiple of four spaces for this converter.',
        span,
      )
    }
  }

  for (const line of lines) {
    if (lineIsIgnored(line) || !isTableDivider(line.text)) continue
    const span = { start: line.start, end: line.fullEnd }
    addFeature('gfm-table', span, 'table')
    addIssue(
      'unsupported-table',
      'table',
      'GFM tables remain blocked until rich-cell and alignment parity is available.',
      span,
    )
  }

  const scanPattern = (
    pattern: RegExp,
    callback: (match: RegExpMatchArray, span: SourceSpan) => void,
  ) => {
    for (const match of markdown.matchAll(pattern)) {
      const span = { start: match.index, end: match.index + match[0].length }
      if (!isCovered(span, ignored)) callback(match, span)
    }
  }

  // eslint-disable-next-line unicorn/better-regex -- Escaping the closing bracket keeps the expression valid in Unicode mode.
  scanPattern(/\[\^[^\]\s]+\]:?/g, (_match, span) => {
    addFeature('footnote', span, 'footnote')
    addIssue(
      'unsupported-footnote',
      'footnote',
      'Footnotes remain blocked until tooltip and navigation parity is available.',
      span,
    )
  })

  // eslint-disable-next-line unicorn/better-regex -- Escaping the closing bracket keeps the expression valid in Unicode mode.
  scanPattern(/^ {0,3}\[[^\]\n]+\]:\s*\S.*$/gm, (_match, span) => {
    addFeature('reference-definition', span)
    addIssue(
      'unsupported-reference-definition',
      'reference-link',
      'Reference links and images are not yet supported by the Lexical importer.',
      span,
    )
  })

  scanPattern(/<(https?:\/\/[^\s>]+)>/g, (match, span) => {
    addFeature('autolink', span, 'autolink')
    createReplacement(span, autoLinkNode(match[1]), false)
    ignored.push(span)
  })

  scanPattern(/<[^\n>@]*@[^\n>]*>/g, (_match, span) => {
    addIssue(
      'unsupported-email-autolink',
      'email-autolink',
      'Email autolinks are not yet supported by the migration profile.',
      span,
    )
  })

  scanPattern(/<!--.*?-->/gs, (_match, span) => {
    addFeature('html-comment', span, 'comment')
    addIssue(
      'unsupported-html-comment',
      'html-comment',
      'HTML comments are blocked until comment-node round-trip parity is verified.',
      span,
    )
    ignored.push(span)
  })

  scanPattern(/<\/?([a-z][\w-]*)(?:\s[^<>]*?)?\/?>/gi, (match, span) => {
    const element = match[1].toLowerCase()
    addFeature('raw-html', span)
    addIssue(
      element === 'script' || element === 'style'
        ? 'unsafe-raw-html'
        : 'unsupported-raw-html',
      'raw-html',
      element === 'script' || element === 'style'
        ? `Raw <${element}> content requires a separate security decision.`
        : `The <${element}> element does not yet have verified Lexical parity.`,
      span,
      { element },
    )
  })

  // Spoilers are protected before mentions and math so nested Markdown cannot
  // be flattened accidentally.
  scanPattern(/\|\|([^\n]+?)\|\|/g, (match, span) => {
    const value = match[1]
    addFeature('spoiler', span, 'spoiler')
    const nestedMarkup =
      // eslint-disable-next-line unicorn/better-regex -- Escaped delimiters avoid non-Unicode parsing ambiguities.
      /\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|==[^=]+==|\+\+[^+]+\+\+|`[^`]+`|\[[^\]]+\]\([^)]+\)|\{(?:GH|TW|TG)@|\$[^$]+\$/.test(
        value,
      )
    if (nestedMarkup) {
      addIssue(
        'unsupported-nested-spoiler-markdown',
        'spoiler',
        'Markdown nested inside a spoiler is blocked until inline-child parity is implemented.',
        span,
      )
    } else {
      createReplacement(span, spoilerNode(value), false)
    }
    ignored.push(span)
  })

  scanPattern(/\|\|[^\n]*\n.*?\|\|/gs, (_match, span) => {
    addFeature('spoiler', span, 'spoiler')
    addIssue(
      'unsupported-multiline-spoiler',
      'spoiler',
      'Multiline spoilers are not yet supported by the migration profile.',
      span,
    )
    ignored.push(span)
  })

  scanPattern(
    // eslint-disable-next-line unicorn/better-regex -- Escaped delimiters avoid non-Unicode parsing ambiguities.
    /(?:\[([^\]\n]*)\])?\{(GH|TW|TG)@(\w+)\}[ \t]?/g,
    (match, span) => {
      addFeature('mention', span, 'mention')
      createReplacement(
        span,
        mentionNode(match[2], match[3], match[1] || undefined),
        false,
      )
      ignored.push(span)
    },
  )

  scanPattern(/(?<!\$)\$([^\n$]+)\$(?=[^$]|$)/g, (match, span) => {
    addFeature('katex-inline', span, 'katex-inline')
    createReplacement(span, katexInlineNode(match[1]), false)
    ignored.push(span)
  })

  scanPattern(/\+\+[^\n+]+\+\+/g, (_match, span) => {
    addFeature('insert', span, 'text')
  })
  scanPattern(/==[^\n=]+==/g, (_match, span) => {
    addFeature('highlight', span, 'text')
  })

  features.sort((a, b) => a.range.start.offset - b.range.start.offset)
  issues.sort(
    (a, b) =>
      a.range.start.offset - b.range.start.offset ||
      a.code.localeCompare(b.code),
  )

  if (issues.length > 0) {
    return {
      status: 'blocked',
      converterVersion: MX_MARKDOWN_CONVERTER_VERSION,
      profile: options.profile,
      sourceHash: hash,
      features,
      issues,
    }
  }

  try {
    const prepared = applyReplacements(markdown, replacements)
    const imported = getSerializedState(prepared)
    const content = postprocessState(
      imported,
      replacements,
      options.blockIdFactory,
    )
    const placeholderMap = new Map(
      replacements.map((replacement) => [replacement.placeholder, replacement]),
    )
    if (containsPlaceholder(content.root as SerializedNode, placeholderMap)) {
      throw new Error('A migration placeholder remained after conversion')
    }

    return {
      status: 'convertible',
      converterVersion: MX_MARKDOWN_CONVERTER_VERSION,
      profile: options.profile,
      sourceHash: hash,
      features,
      content,
      text: mxLexicalToMarkdown(content),
    }
  } catch (error) {
    const span = { start: 0, end: markdown.length }
    return {
      status: 'blocked',
      converterVersion: MX_MARKDOWN_CONVERTER_VERSION,
      profile: options.profile,
      sourceHash: hash,
      features,
      issues: [
        {
          code: 'conversion-failed',
          feature: 'document',
          message: 'The Markdown document could not be converted safely.',
          range: toRange(markdown, lineStarts, span),
          severity: 'blocking',
          details: {
            reason: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }
  }
}
