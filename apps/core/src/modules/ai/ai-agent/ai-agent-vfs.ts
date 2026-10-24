import type { AgentFileSnapshot } from '@mx-space/ai'
import { createTwoFilesPatch } from 'diff'

export type KnownFiles = Record<string, string>

export interface FileReconcileResult {
  reminder: string | null
  known: KnownFiles
  paths: string[]
}

export function recordFiles(
  known: KnownFiles,
  snapshots: readonly AgentFileSnapshot[],
): KnownFiles {
  const next = { ...known }
  for (const { path, content } of snapshots) next[path] = content
  return next
}

export function reconcileFiles(
  known: KnownFiles,
  snapshots: readonly AgentFileSnapshot[],
): FileReconcileResult {
  const next = { ...known }
  const sections: string[] = []
  const paths: string[] = []

  for (const { path, content, attach } of snapshots) {
    const previous = known[path]
    if (previous === undefined) {
      if (!attach || content.trim() === '') continue
      sections.push(`${path} (attached by the user):\n${content}`)
    } else if (previous === content) {
      continue
    } else {
      sections.push(describeChange(path, previous, content))
    }
    next[path] = content
    paths.push(path)
  }

  return {
    reminder: sections.length
      ? `<system-reminder>\n${sections.join('\n\n')}\n</system-reminder>`
      : null,
    known: next,
    paths,
  }
}

function describeChange(path: string, previous: string, current: string) {
  const patch = createTwoFilesPatch(
    path,
    path,
    ensureTrailingNewline(previous),
    ensureTrailingNewline(current),
    'last seen by you',
    'current',
  )
  const body = patch.split('\n').slice(2).join('\n').trimEnd()
  return [
    `${path} changed since you last saw it, not through your own tool calls: the user edited the article or reviewed your proposals.`,
    'Unified diff from your last view to the current content:',
    '```diff',
    body,
    '```',
  ].join('\n')
}

function ensureTrailingNewline(text: string) {
  return text.endsWith('\n') ? text : `${text}\n`
}
