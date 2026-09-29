import { describe, expect, it } from 'vitest'

import { groupHistory, type HistoryEntry } from './history'

const entry = (
  counter: number,
  timestamp: number,
  message: string,
): HistoryEntry => ({
  id: { peer: '1', counter },
  lamport: counter,
  timestamp,
  message,
})

describe('groupHistory', () => {
  it('coalesces human edits separated by short idle gaps into one row', () => {
    const rows = groupHistory([
      entry(5, 1000, 'human'),
      entry(4, 990, 'human'),
      entry(3, 950, 'human'),
      entry(2, 700, 'human'),
    ])
    expect(rows.map((row) => [row.kind, row.id.counter, row.count])).toEqual([
      ['human', 5, 3],
      ['human', 2, 1],
    ])
  })

  it('keeps agent, session and restore entries as their own rows', () => {
    const rows = groupHistory([
      entry(4, 1000, 'restore 1@1'),
      entry(3, 999, 'human'),
      entry(2, 998, 'agent: +1 ~0 -0 blocks'),
      entry(1, 997, 'session 2026-09-29T08:00:00.000Z'),
    ])
    expect(rows.map((row) => row.kind)).toEqual([
      'restore',
      'human',
      'agent',
      'session',
    ])
  })
})
