import { mxLexicalToMarkdown } from '@mx-space/editor'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

import type { CreateDraftData } from '~/api/drafts'
import type { DraftModel, TypeSpecificData } from '~/models/draft'

export type DraftMergeConflictKind =
  'block' | 'delete-edit' | 'field' | 'order' | 'text'

export interface DraftMergeConflict {
  base: unknown
  kind: DraftMergeConflictKind
  local: unknown
  path: string
  remote: unknown
}

export interface DraftMergeResult {
  autoMergedChanges: number
  conflicts: DraftMergeConflict[]
  data: CreateDraftData
}

interface MergeContext {
  autoMergedChanges: number
  conflicts: DraftMergeConflict[]
}

interface TextEdit {
  end: number
  replacement: string
  start: number
}

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false

  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    deepEqual(leftKeys, rightKeys) &&
    leftKeys.every((key) => deepEqual(left[key], right[key]))
  )
}

function mergeValue<T>(
  base: T,
  local: T,
  remote: T,
  path: string,
  context: MergeContext,
  kind: DraftMergeConflictKind = 'field',
): T {
  if (deepEqual(local, remote)) return local
  if (deepEqual(local, base)) {
    context.autoMergedChanges += 1
    return remote
  }
  if (deepEqual(remote, base)) return local

  context.conflicts.push({ base, kind, local, path, remote })
  return local
}

function mergeRecord(
  base: JsonRecord | null | undefined,
  local: JsonRecord | null | undefined,
  remote: JsonRecord | null | undefined,
  path: string,
  context: MergeContext,
): JsonRecord | null | undefined {
  if (deepEqual(local, remote)) return local
  if (deepEqual(local, base)) {
    context.autoMergedChanges += 1
    return remote
  }
  if (deepEqual(remote, base)) return local

  const values = [base, local, remote].filter(
    (value) => value !== undefined && value !== null,
  )
  if (!values.every(isRecord)) {
    return mergeValue(base, local, remote, path, context)
  }

  const keys = new Set([
    ...Object.keys(base ?? {}),
    ...Object.keys(local ?? {}),
    ...Object.keys(remote ?? {}),
  ])
  const result: JsonRecord = {}

  for (const key of keys) {
    const nextPath = `${path}.${key}`
    const baseValue = base?.[key]
    const localValue = local?.[key]
    const remoteValue = remote?.[key]
    const nestedValues = [baseValue, localValue, remoteValue].filter(
      (value) => value !== undefined && value !== null,
    )

    const merged = nestedValues.every(isRecord)
      ? mergeRecord(
          baseValue as JsonRecord | null | undefined,
          localValue as JsonRecord | null | undefined,
          remoteValue as JsonRecord | null | undefined,
          nextPath,
          context,
        )
      : mergeValue(baseValue, localValue, remoteValue, nextPath, context)

    if (merged !== undefined) result[key] = merged
  }

  return result
}

function findSingleTextEdit(base: string, value: string): TextEdit | null {
  if (base === value) return null

  let start = 0
  const sharedLength = Math.min(base.length, value.length)
  while (start < sharedLength && base[start] === value[start]) start += 1

  let baseEnd = base.length
  let valueEnd = value.length
  while (
    baseEnd > start &&
    valueEnd > start &&
    base[baseEnd - 1] === value[valueEnd - 1]
  ) {
    baseEnd -= 1
    valueEnd -= 1
  }

  return {
    end: baseEnd,
    replacement: value.slice(start, valueEnd),
    start,
  }
}

function editsOverlap(left: TextEdit, right: TextEdit): boolean {
  if (
    left.start === left.end &&
    right.start === right.end &&
    left.start === right.start
  ) {
    return true
  }
  return left.start < right.end && right.start < left.end
}

function applyTextEdits(base: string, edits: TextEdit[]): string {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (value, edit) =>
        `${value.slice(0, edit.start)}${edit.replacement}${value.slice(edit.end)}`,
      base,
    )
}

function mergeText(
  base: string,
  local: string,
  remote: string,
  path: string,
  context: MergeContext,
): string {
  if (local === remote) return local
  if (local === base) {
    context.autoMergedChanges += 1
    return remote
  }
  if (remote === base) return local

  const localEdit = findSingleTextEdit(base, local)
  const remoteEdit = findSingleTextEdit(base, remote)
  if (localEdit && remoteEdit && !editsOverlap(localEdit, remoteEdit)) {
    context.autoMergedChanges += 1
    return applyTextEdits(base, [localEdit, remoteEdit])
  }

  context.conflicts.push({
    base,
    kind: 'text',
    local,
    path,
    remote,
  })
  return local
}

function parseLexicalState(
  value: string | undefined,
): SerializedEditorState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as SerializedEditorState
    return Array.isArray(parsed?.root?.children) ? parsed : null
  } catch {
    return null
  }
}

function getBlockId(node: SerializedLexicalNode): string | null {
  const state = (
    node as SerializedLexicalNode & {
      $?: { blockId?: unknown }
    }
  ).$
  return typeof state?.blockId === 'string' && state.blockId
    ? state.blockId
    : null
}

function indexBlocks(nodes: SerializedLexicalNode[]) {
  const result = new Map<string, SerializedLexicalNode>()
  for (const node of nodes) {
    const blockId = getBlockId(node)
    if (!blockId || result.has(blockId)) return null
    result.set(blockId, node)
  }
  return result
}

function sameOrder(left: string[], right: string[]): boolean {
  return deepEqual(left, right)
}

function insertMissingBlocks(
  target: string[],
  source: string[],
  alive: Set<string>,
) {
  for (let index = 0; index < source.length; index += 1) {
    const id = source[index]
    if (!alive.has(id) || target.includes(id)) continue

    const previous = source
      .slice(0, index)
      .reverse()
      .find((candidate) => target.includes(candidate))
    if (previous) {
      target.splice(target.indexOf(previous) + 1, 0, id)
      continue
    }

    const next = source
      .slice(index + 1)
      .find((candidate) => target.includes(candidate))
    if (next) target.splice(target.indexOf(next), 0, id)
    else target.push(id)
  }
}

function mergeBlockOrder(
  baseOrder: string[],
  localOrder: string[],
  remoteOrder: string[],
  alive: Set<string>,
  context: MergeContext,
): string[] {
  const commonBaseIds = baseOrder.filter(
    (id) =>
      localOrder.includes(id) && remoteOrder.includes(id) && alive.has(id),
  )
  const localBaseOrder = localOrder.filter((id) => commonBaseIds.includes(id))
  const remoteBaseOrder = remoteOrder.filter((id) => commonBaseIds.includes(id))
  const localReordered = !sameOrder(localBaseOrder, commonBaseIds)
  const remoteReordered = !sameOrder(remoteBaseOrder, commonBaseIds)

  if (
    localReordered &&
    remoteReordered &&
    !sameOrder(localBaseOrder, remoteBaseOrder)
  ) {
    context.conflicts.push({
      base: commonBaseIds,
      kind: 'order',
      local: localBaseOrder,
      path: 'content.order',
      remote: remoteBaseOrder,
    })
  } else if (localReordered !== remoteReordered) {
    context.autoMergedChanges += 1
  }

  const preferLocal = localReordered && !remoteReordered
  const target = (preferLocal ? localOrder : remoteOrder).filter((id) =>
    alive.has(id),
  )
  insertMissingBlocks(target, preferLocal ? remoteOrder : localOrder, alive)
  return target
}

function mergeLexicalContent(
  base: string,
  local: string,
  remote: string,
  context: MergeContext,
): string {
  if (local === remote) return local
  if (local === base) {
    context.autoMergedChanges += 1
    return remote
  }
  if (remote === base) return local

  const baseState = parseLexicalState(base)
  const localState = parseLexicalState(local)
  const remoteState = parseLexicalState(remote)
  if (!baseState || !localState || !remoteState) {
    return mergeValue(base, local, remote, 'content', context, 'block')
  }

  const baseNodes = baseState.root.children as SerializedLexicalNode[]
  const localNodes = localState.root.children as SerializedLexicalNode[]
  const remoteNodes = remoteState.root.children as SerializedLexicalNode[]
  const baseBlocks = indexBlocks(baseNodes)
  const localBlocks = indexBlocks(localNodes)
  const remoteBlocks = indexBlocks(remoteNodes)
  if (!baseBlocks || !localBlocks || !remoteBlocks) {
    return mergeValue(base, local, remote, 'content', context, 'block')
  }

  const blockIds = new Set([
    ...baseBlocks.keys(),
    ...localBlocks.keys(),
    ...remoteBlocks.keys(),
  ])
  const mergedBlocks = new Map<string, SerializedLexicalNode>()

  for (const blockId of blockIds) {
    const baseBlock = baseBlocks.get(blockId)
    const localBlock = localBlocks.get(blockId)
    const remoteBlock = remoteBlocks.get(blockId)
    const deleteEdit =
      baseBlock !== undefined &&
      ((localBlock === undefined && !deepEqual(remoteBlock, baseBlock)) ||
        (remoteBlock === undefined && !deepEqual(localBlock, baseBlock)))
    const merged = mergeValue(
      baseBlock,
      localBlock,
      remoteBlock,
      `content.blocks.${blockId}`,
      context,
      deleteEdit ? 'delete-edit' : 'block',
    )
    if (merged) mergedBlocks.set(blockId, merged)
  }

  const order = mergeBlockOrder(
    baseNodes.map((node) => getBlockId(node)!),
    localNodes.map((node) => getBlockId(node)!),
    remoteNodes.map((node) => getBlockId(node)!),
    new Set(mergedBlocks.keys()),
    context,
  )
  const mergedState: SerializedEditorState = {
    ...remoteState,
    root: {
      ...remoteState.root,
      children: order.map((blockId) => mergedBlocks.get(blockId)!),
    },
  }
  return JSON.stringify(mergedState)
}

function draftToData(draft: DraftModel): CreateDraftData {
  return {
    content: draft.content,
    contentFormat: draft.contentFormat,
    images: draft.images,
    meta: draft.meta,
    refId: draft.refId,
    refType: draft.refType,
    text: draft.text,
    title: draft.title,
    typeSpecificData: draft.typeSpecificData as TypeSpecificData,
  }
}

export function mergeDraftConflict(input: {
  base: DraftModel
  local: CreateDraftData
  remote: DraftModel
}): DraftMergeResult {
  const context: MergeContext = { autoMergedChanges: 0, conflicts: [] }
  const base = draftToData(input.base)
  const remote = draftToData(input.remote)
  const contentFormat = mergeValue(
    base.contentFormat,
    input.local.contentFormat,
    remote.contentFormat,
    'contentFormat',
    context,
  )
  const data: CreateDraftData = {
    contentFormat,
    images: mergeValue(
      base.images,
      input.local.images,
      remote.images,
      'images',
      context,
    ),
    meta: mergeRecord(
      base.meta,
      input.local.meta,
      remote.meta,
      'meta',
      context,
    ) as Record<string, unknown> | undefined,
    refId: input.remote.refId,
    refType: input.remote.refType,
    title: mergeValue(
      base.title,
      input.local.title,
      remote.title,
      'title',
      context,
    ),
    typeSpecificData: mergeRecord(
      base.typeSpecificData as JsonRecord | undefined,
      input.local.typeSpecificData as JsonRecord | undefined,
      remote.typeSpecificData as JsonRecord | undefined,
      'typeSpecificData',
      context,
    ) as TypeSpecificData | undefined,
  }

  if (contentFormat === 'lexical') {
    data.content = mergeLexicalContent(
      base.content ?? '',
      input.local.content ?? '',
      remote.content ?? '',
      context,
    )
    try {
      data.text = mxLexicalToMarkdown(data.content)
    } catch {
      data.text = mergeText(
        base.text ?? '',
        input.local.text ?? '',
        remote.text ?? '',
        'text',
        context,
      )
    }
  } else {
    data.text = mergeText(
      base.text ?? '',
      input.local.text ?? '',
      remote.text ?? '',
      'text',
      context,
    )
  }

  return {
    autoMergedChanges: context.autoMergedChanges,
    conflicts: context.conflicts,
    data,
  }
}
