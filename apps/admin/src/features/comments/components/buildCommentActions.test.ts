// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import type { CommentModel } from '~/models/comment'
import { CommentState } from '~/models/comment'

import { buildCommentActions } from './buildCommentActions'

function makeComment(id: string): CommentModel {
  return {
    author: id,
    createdAt: '2026-06-01T00:00:00.000Z',
    id,
    refType: 'post',
    state: CommentState.Unread,
    text: id,
  }
}

const t = ((key: string) => key) as Parameters<typeof buildCommentActions>[1]

function makeDeps() {
  return {
    closeDetail: vi.fn(),
    deleteMany: vi.fn(async () => undefined),
    getNextOf: vi.fn(),
    markState: vi.fn(async () => undefined),
    open: vi.fn(),
  }
}

describe('buildCommentActions registry shape', () => {
  it('declares the five documented keys with the documented shortcuts', () => {
    const actions = buildCommentActions(makeDeps(), t)
    const byKey = new Map(actions.map((a) => [a.key, a]))
    expect(byKey.get('mark-read')?.shortcut).toBe('e')
    expect(byKey.get('mark-read-next')?.shortcut).toBe('Alt+e')
    expect(byKey.get('mark-junk')?.shortcut).toBe('s')
    expect(byKey.get('mark-junk-next')?.shortcut).toBe('Alt+s')
    expect(byKey.get('delete')?.shortcut).toBe('Backspace')
    expect(byKey.get('delete')?.multi).toBe(true)
    expect(byKey.get('delete')?.danger).toBe(true)
  })
})

describe('mark-read action', () => {
  it('calls markState(id, Read) with the first target', async () => {
    const deps = makeDeps()
    const actions = buildCommentActions(deps, t)
    const action = actions.find((a) => a.key === 'mark-read')!
    await action.run([makeComment('c1')])
    expect(deps.markState).toHaveBeenCalledWith('c1', CommentState.Read)
  })
})

describe('mark-read-next action', () => {
  it('marks the target read, then opens the next row from getNextOf', async () => {
    const deps = makeDeps()
    const next = makeComment('c2')
    deps.getNextOf.mockReturnValue(next)
    const actions = buildCommentActions(deps, t)
    const action = actions.find((a) => a.key === 'mark-read-next')!
    await action.run([makeComment('c1')])
    expect(deps.markState).toHaveBeenCalledWith('c1', CommentState.Read)
    expect(deps.getNextOf).toHaveBeenCalledWith('c1')
    expect(deps.open).toHaveBeenCalledWith(next)
    expect(deps.closeDetail).not.toHaveBeenCalled()
  })

  it('closes the detail pane when getNextOf returns null', async () => {
    const deps = makeDeps()
    deps.getNextOf.mockReturnValue(null)
    const actions = buildCommentActions(deps, t)
    const action = actions.find((a) => a.key === 'mark-junk-next')!
    await action.run([makeComment('c1')])
    expect(deps.markState).toHaveBeenCalledWith('c1', CommentState.Junk)
    expect(deps.open).not.toHaveBeenCalled()
    expect(deps.closeDetail).toHaveBeenCalledTimes(1)
  })
})

describe('delete action', () => {
  it('passes through the full target list to deleteMany', async () => {
    const deps = makeDeps()
    const actions = buildCommentActions(deps, t)
    const action = actions.find((a) => a.key === 'delete')!
    const targets = [makeComment('c1'), makeComment('c2')]
    await action.run(targets)
    expect(deps.deleteMany).toHaveBeenCalledWith(targets)
  })
})
