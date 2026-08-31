import type { DraftModel, VersionTreeNode } from '~/models/draft'

export const MAX_LANE = 3

export type GraphRowKind = 'draft' | 'online' | 'published' | 'revision'

export interface GraphRow {
  continues: boolean
  incoming: boolean
  draft: DraftModel | null
  kind: GraphRowKind
  lane: number
  lanesMerging: number[]
  lanesThrough: number[]
  node: VersionTreeNode
}

const nodeTime = (node: VersionTreeNode) =>
  Date.parse(node.publishedAt ?? node.revision.createdAt)

const orderNodes = (nodes: VersionTreeNode[]): VersionTreeNode[] => {
  const byId = new Map(nodes.map((node) => [node.revision.id, node]))
  const pendingChildren = new Map(nodes.map((node) => [node.revision.id, 0]))
  for (const node of nodes) {
    const parentId = node.parentNodeId
    if (parentId && byId.has(parentId)) {
      pendingChildren.set(parentId, (pendingChildren.get(parentId) ?? 0) + 1)
    }
  }

  const ordered: VersionTreeNode[] = []
  const remaining = new Set(byId.keys())
  while (remaining.size > 0) {
    let next: VersionTreeNode | null = null
    for (const id of remaining) {
      const candidate = byId.get(id)!
      if (pendingChildren.get(id) !== 0) continue
      if (!next || nodeTime(candidate) > nodeTime(next)) next = candidate
    }
    if (!next) {
      for (const id of remaining) {
        const candidate = byId.get(id)!
        if (!next || nodeTime(candidate) > nodeTime(next)) next = candidate
      }
    }
    const chosen = next!
    remaining.delete(chosen.revision.id)
    ordered.push(chosen)
    const parentId = chosen.parentNodeId
    if (parentId && pendingChildren.has(parentId)) {
      pendingChildren.set(parentId, (pendingChildren.get(parentId) ?? 1) - 1)
    }
  }

  return ordered
}

export const buildGraphRows = (
  nodes: VersionTreeNode[],
  drafts: DraftModel[],
  currentPublishedRevisionId: string | null,
): GraphRow[] => {
  const draftByHeadId = new Map(
    drafts.map((draft) => [draft.headRevisionId, draft]),
  )
  const knownIds = new Set(nodes.map((node) => node.revision.id))
  const orphanNodes: VersionTreeNode[] = drafts
    .filter((draft) => !knownIds.has(draft.headRevisionId))
    .map((draft) => ({
      branchBaseIds: [],
      branchHeadIds: [draft.id],
      collapsedRevisionCount: 0,
      parentNodeId: draft.baseRevisionId,
      publishedAt: null,
      revision: draft.headRevision,
    }))
  for (const node of orphanNodes) knownIds.add(node.revision.id)
  const lanes: (string | null)[] = []
  const rows: GraphRow[] = []

  for (const node of orderNodes([...nodes, ...orphanNodes])) {
    const id = node.revision.id
    const claimed: number[] = []
    for (const [index, reserved] of lanes.entries()) {
      if (reserved === id) claimed.push(index)
    }

    let lane: number
    if (claimed.length > 0) {
      ;[lane] = claimed
    } else {
      lane = lanes.indexOf(null)
      if (lane < 0) lane = lanes.length
    }

    const lanesMerging = claimed.slice(1)
    const lanesThrough: number[] = []
    for (const [index, reserved] of lanes.entries()) {
      if (
        reserved !== null &&
        index !== lane &&
        !lanesMerging.includes(index)
      ) {
        lanesThrough.push(index)
      }
    }

    const parentId =
      node.parentNodeId && knownIds.has(node.parentNodeId)
        ? node.parentNodeId
        : null
    for (const index of lanesMerging) lanes[index] = null
    lanes[lane] = parentId

    const draft = draftByHeadId.get(id) ?? null
    const kind: GraphRowKind = draft
      ? 'draft'
      : id === currentPublishedRevisionId
        ? 'online'
        : node.publishedAt
          ? 'published'
          : 'revision'

    rows.push({
      continues: parentId !== null,
      incoming: claimed.length > 0,
      draft,
      kind,
      lane,
      lanesMerging,
      lanesThrough,
      node,
    })
  }

  while (lanes.length > 0 && lanes.at(-1) === null) lanes.pop()

  return rows
}

export const laneCount = (rows: GraphRow[]) =>
  rows.reduce(
    (widest, row) =>
      Math.max(widest, row.lane, ...row.lanesThrough, ...row.lanesMerging),
    0,
  ) + 1
