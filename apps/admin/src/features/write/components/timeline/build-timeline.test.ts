import { describe, expect, it } from 'vitest'

import type { DraftHistory } from '~/models/draft'

import { buildTimeline } from './build-timeline'

const change = (
  peer: `${number}`,
  counter: number,
  timestamp: number,
  message: string,
  deps: { counter: number; peer: `${number}` }[] = [],
) => ({ deps, id: { counter, peer }, lamport: counter, message, timestamp })

const at = (seconds: number) => new Date(seconds * 1000).toISOString()

describe('buildTimeline', () => {
  it('merges checkpoints and grouped steps newest first', () => {
    const history: DraftHistory = {
      changes: [
        change('2', 9, 400, 'agent:shorten', [{ counter: 5, peer: '1' }]),
        change('2', 8, 390, 'agent:shorten', [{ counter: 4, peer: '1' }]),
        change('1', 5, 300, 'human:owner', [{ counter: 4, peer: '1' }]),
        change('1', 4, 280, 'human:owner', [{ counter: 3, peer: '1' }]),
        change('1', 3, 100, 'import 7'),
      ],
      checkpoints: [
        {
          contentFormat: 'lexical',
          createdAt: at(350),
          frontiers: [],
          id: 'c2',
          kind: 'save',
          parentRevisionId: 'c1',
          title: 'T',
        },
        {
          contentFormat: 'lexical',
          createdAt: at(100),
          frontiers: [],
          id: 'c1',
          kind: 'import',
          parentRevisionId: 'p',
          title: 'T',
        },
        {
          contentFormat: 'lexical',
          createdAt: at(50),
          frontiers: null,
          id: 'p',
          kind: null,
          parentRevisionId: null,
          title: 'T',
        },
      ],
    }

    const rows = buildTimeline(history, 'p')

    expect(
      rows.map((row) =>
        row.type === 'step' ? `${row.kind}:${row.count}` : row.id,
      ),
    ).toEqual(['agent:2', 'c2', 'human:2', 'c1', 'p'])
    const agent = rows[0]
    expect(agent).toMatchObject({
      before: [{ counter: 4, peer: '1' }],
      change: { counter: 9, peer: '2' },
      undoable: true,
    })
    expect(rows.at(-1)).toMatchObject({ published: true })
  })

  it('splits human edits separated by an idle gap', () => {
    const rows = buildTimeline(
      {
        changes: [
          change('1', 2, 1000, 'human:owner'),
          change('1', 1, 100, 'human:owner'),
        ],
        checkpoints: [],
      },
      null,
    )

    expect(rows).toHaveLength(2)
  })

  it('does not offer undo for server bookkeeping steps', () => {
    const rows = buildTimeline(
      { changes: [change('1', 1, 1, 'restore c1')], checkpoints: [] },
      null,
    )

    expect(rows[0]).toMatchObject({ kind: 'restore', undoable: false })
  })

  it('keeps each co-author in their own steps and names who wrote them', () => {
    const history: DraftHistory = {
      changes: [
        change('3', 2, 210, 'human:r1'),
        change('1', 6, 205, 'human:owner'),
        change('3', 1, 200, 'human:r1'),
      ],
      checkpoints: [],
    }

    const steps = buildTimeline(history, null).filter(
      (row) => row.type === 'step',
    )

    expect(
      steps.map((row) => (row.type === 'step' ? row.author : undefined)),
    ).toEqual(['r1', null, 'r1'])
  })
})
