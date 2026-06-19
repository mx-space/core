import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMxs } from '../../src/helpers/mxs'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

const VERB_SAMPLES = [
  {
    verb: ['post', 'create'],
    stableFlag: '--title',
  },
  {
    verb: ['ai', 'summary', 'list'],
    stableFlag: '--grouped',
  },
  {
    verb: ['skill', 'get'],
    stableFlag: 'slug',
  },
  {
    verb: ['auth', 'login'],
    stableFlag: '--production',
  },
  {
    verb: ['file', 'upload'],
    stableFlag: 'path',
  },
] as const

describe('mxs verb --help drift smoke', () => {
  let tmpHome: TmpHome

  beforeAll(() => {
    tmpHome = makeTmpHome()
  })

  afterAll(() => {
    tmpHome?.cleanup()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  for (const { verb, stableFlag } of VERB_SAMPLES) {
    const label = verb.join(' ')

    it(`mxs ${label} --help exits 0`, async () => {
      const result = await runMxs([...verb, '--help'], env())
      expect(result.code, result.stderr).toBe(0)
    })

    it(`mxs ${label} --help contains the leaf verb name`, async () => {
      const result = await runMxs([...verb, '--help'], env())
      const leafVerb = verb[verb.length - 1]
      expect(result.stdout).toContain(leafVerb)
    })

    it(`mxs ${label} --help contains stable flag "${stableFlag}"`, async () => {
      const result = await runMxs([...verb, '--help'], env())
      expect(result.stdout).toContain(stableFlag)
    })
  }
})
