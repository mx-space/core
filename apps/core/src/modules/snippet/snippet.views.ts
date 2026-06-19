import { z } from 'zod'

import { SnippetType } from './snippet.schema'
import type {
  SkillAssetView,
  SkillBundleView,
  SnippetRow,
} from './snippet.types'

export const SkillAssetViewSchema = z.object({
  path: z.string(),
  rawUrl: z.string(),
  type: z.string(),
  size: z.number().int().nonnegative(),
})

export const SkillBundleViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rawUrl: z.string(),
  assets: z.array(SkillAssetViewSchema),
})

const SKILL_LEAF = '/SKILL.md'

export function stripSkillSuffix(path: string): string {
  return path.endsWith(SKILL_LEAF) ? path.slice(0, -SKILL_LEAF.length) : path
}

export function deriveSkillName(path: string): string {
  const segments = path.split('/')
  return segments.at(-2) ?? ''
}

function buildRawUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/$/, '')
  return base ? `${base}/s/${path}` : `/s/${path}`
}

function toSkillAssetView(
  row: SnippetRow,
  bundleDir: string,
  serverUrl: string,
): SkillAssetView {
  const relPath = row.path.startsWith(`${bundleDir}/`)
    ? row.path.slice(bundleDir.length + 1)
    : row.path
  return {
    path: relPath,
    rawUrl: buildRawUrl(serverUrl, row.path),
    type: (row.type as SnippetType | null) ?? SnippetType.Text,
    size: Buffer.byteLength(row.raw, 'utf8'),
  }
}

export function toSkillBundleView(
  row: SnippetRow,
  assetRows: SnippetRow[],
  serverUrl: string,
): SkillBundleView {
  const bundleDir = stripSkillSuffix(row.path)
  return {
    id: String(row.id),
    name: deriveSkillName(row.path),
    description: row.comment ?? '',
    rawUrl: buildRawUrl(serverUrl, row.path),
    assets: assetRows.map((asset) =>
      toSkillAssetView(asset, bundleDir, serverUrl),
    ),
  }
}
