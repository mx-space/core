import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMxs } from '../../src/helpers/mxs'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

// Source of truth: packages/cli/src/cli/help/index.ts GROUP_NAMES
const REGISTERED_GROUPS = [
  'auth',
  'profile',
  'post',
  'note',
  'page',
  'project',
  'category',
  'topic',
  'comment',
  'snippet',
  'ai',
  'config',
  'skill',
  'preview',
  'update',
] as const

describe('mxs root help', () => {
  let tmpHome: TmpHome

  beforeAll(() => {
    tmpHome = makeTmpHome()
  })

  afterAll(() => {
    tmpHome?.cleanup()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  it('mxs --help exits 0 with non-empty stdout', async () => {
    const result = await runMxs(['--help'], env())
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().length).toBeGreaterThan(0)
  })

  it('bare mxs exits 0 with same non-empty stdout', async () => {
    const result = await runMxs([], env())
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().length).toBeGreaterThan(0)
  })

  it('root help contains the binary name', async () => {
    const result = await runMxs(['--help'], env())
    expect(result.stdout).toContain('mxs')
  })

  it('root help contains every registered group', async () => {
    const result = await runMxs(['--help'], env())
    for (const group of REGISTERED_GROUPS) {
      expect(result.stdout, `missing group: ${group}`).toContain(group)
    }
  })
})
