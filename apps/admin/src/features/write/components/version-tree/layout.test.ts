import { describe, expect, it } from 'vitest'

import type {
  ContentRevision,
  DraftModel,
  VersionTreeNode,
} from '~/models/draft'
import { DraftRefType } from '~/models/draft'

import { buildGraphRows, laneCount } from './layout'

const revision = (id: string, minutesAgo: number): ContentRevision => ({
  content: null,
  contentFormat: 'markdown',
  createdAt: new Date(
    Date.UTC(2026, 7, 31, 12) - minutesAgo * 60_000,
  ).toISOString(),
  documentId: 'document-1',
  id,
  images: null,
  meta: null,
  parentRevisionId: null,
  text: id,
  title: id,
  typeSpecificData: null,
})

const node = (
  id: string,
  parentNodeId: string | null,
  minutesAgo: number,
  publishedAt: string | null = null,
): VersionTreeNode => ({
  branchBaseIds: [],
  branchHeadIds: [],
  collapsedRevisionCount: 0,
  parentNodeId,
  publishedAt,
  revision: revision(id, minutesAgo),
})

const draft = (id: string, headRevisionId: string): DraftModel => ({
  baseRevision: revision('root', 100),
  baseRevisionId: 'root',
  commonAncestorRevisionId: 'root',
  createdAt: revision(id, 10).createdAt,
  document: {
    createdAt: revision(id, 100).createdAt,
    id: 'document-1',
    publishedRevisionId: 'online',
    refId: 'post-1',
    refType: DraftRefType.Post,
    updatedAt: null,
  },
  documentId: 'document-1',
  headRevision: revision(headRevisionId, 10),
  headRevisionId,
  id,
  publishedRevision: null,
  relationToPublished: 'diverged',
  status: 'active',
  updatedAt: null,
})

describe('buildGraphRows', () => {
  it('places children above parents and merges a fork back into one lane', () => {
    const nodes = [
      node('root', null, 100),
      node('online', 'root', 80, '2026-08-31T11:00:00.000Z'),
      node('fork', 'root', 40),
      node('tip', 'online', 10),
    ]

    const rows = buildGraphRows(nodes, [draft('branch-a', 'tip')], 'online')
    const ids = rows.map((row) => row.node.revision.id)

    expect(ids).toEqual(['tip', 'fork', 'online', 'root'])
    expect(rows[0].kind).toBe('draft')
    expect(rows[2].kind).toBe('online')
    expect(laneCount(rows)).toBe(2)

    const forkRow = rows[1]
    expect(forkRow.lane).not.toBe(rows[0].lane)
    expect(rows[2].lanesThrough).toContain(forkRow.lane)

    const rootRow = rows.at(-1)!
    expect(rootRow.lanesMerging).toHaveLength(1)
    expect(rootRow.continues).toBe(false)
  })

  it('keeps a single lane for a linear history', () => {
    const rows = buildGraphRows(
      [node('root', null, 100), node('mid', 'root', 50), node('tip', 'mid', 5)],
      [],
      null,
    )

    expect(laneCount(rows)).toBe(1)
    expect(rows.every((row) => row.lanesThrough.length === 0)).toBe(true)
    expect(rows.map((row) => row.continues)).toEqual([true, true, false])
  })
})
