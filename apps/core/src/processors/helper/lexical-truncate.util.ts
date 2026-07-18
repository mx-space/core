import { mxLexicalToMarkdown } from '@mx-space/editor'

interface LexicalEditorState {
  root: {
    children: unknown[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

function parseLexicalState(contentJson: string): LexicalEditorState {
  const parsed = JSON.parse(contentJson)
  if (!parsed?.root || !Array.isArray(parsed.root.children)) {
    throw new Error('Invalid Lexical editor state: missing root.children')
  }
  return parsed
}

export function truncateLexicalContent(
  contentJson: string,
  nBlocks: number,
): string {
  const state = parseLexicalState(contentJson)

  if (nBlocks >= state.root.children.length) {
    return contentJson
  }

  const truncated: LexicalEditorState = {
    ...state,
    root: {
      ...state.root,
      children: state.root.children.slice(0, Math.max(nBlocks, 0)),
    },
  }

  return JSON.stringify(truncated)
}

export function renderTeaserText(truncatedJson: string): string {
  parseLexicalState(truncatedJson)
  return mxLexicalToMarkdown(truncatedJson)
}

export function countTopLevelBlocks(contentJson: string): number {
  return parseLexicalState(contentJson).root.children.length
}

export function resolveEffectivePreviewBlocks(
  contentJson: string,
  configuredPreviewBlocks: unknown,
): number {
  const blockCount = countTopLevelBlocks(contentJson)
  const configured =
    typeof configuredPreviewBlocks === 'number' &&
    Number.isFinite(configuredPreviewBlocks)
      ? Math.max(1, Math.floor(configuredPreviewBlocks))
      : 3
  return Math.max(0, Math.min(configured, blockCount - 1))
}
