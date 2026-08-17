import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const metaDir = path.resolve(__dirname, '../../../src/database/migrations/meta')

interface Snapshot {
  id: string
  prevId: string
}

const snapshots = () =>
  fs
    .readdirSync(metaDir)
    .filter((file) => file.endsWith('_snapshot.json'))
    .sort()
    .map((file) => ({
      file,
      ...(JSON.parse(
        fs.readFileSync(path.join(metaDir, file), 'utf8'),
      ) as Snapshot),
    }))

describe('drizzle migration snapshots', () => {
  // drizzle-kit resolves the parent of each snapshot by `prevId`; a duplicated
  // or misaligned id makes `drizzle-kit check` report a collision and makes the
  // next generated migration diff against the wrong base.
  it('gives every snapshot a unique id', () => {
    const ids = snapshots().map((snapshot) => snapshot.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chains each snapshot to the one before it', () => {
    const all = snapshots()
    const breaks = all.flatMap((snapshot, index) => {
      const previous = all[index - 1]
      if (!previous || snapshot.prevId === previous.id) return []
      return [`${snapshot.file} points at ${snapshot.prevId}`]
    })
    expect(breaks).toEqual([])
  })
})
