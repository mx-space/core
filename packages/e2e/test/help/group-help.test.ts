import { afterAll, beforeAll, describe, expect } from 'vitest'

import { runMxs } from '../../src/helpers/mxs'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

const GROUPS_TO_TEST = [
  'auth',
  'post',
  'ai',
  'skill',
  'file',
  'config',
  'profile',
  'comment',
] as const

describe('mxs group help', () => {
  let tmpHome: TmpHome

  beforeAll(() => {
    tmpHome = makeTmpHome()
  })

  afterAll(() => {
    tmpHome?.cleanup()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  describe.each(GROUPS_TO_TEST.map((g) => [g]))('%s', (group) => {
    it(`mxs ${group} exits 0 and contains group name`, async () => {
      const result = await runMxs([group], env())
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain(group)
    })

    it(`mxs ${group} --help exits 0 and contains group name`, async () => {
      const result = await runMxs([group, '--help'], env())
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain(group)
    })

    it(`mxs ${group} --help lists at least one verb or option`, async () => {
      const result = await runMxs([group, '--help'], env())
      const hasVerb =
        result.stdout.includes('Verb') ||
        result.stdout.includes('Options') ||
        result.stdout.includes('Flag') ||
        result.stdout.includes('OPTIONS') ||
        result.stdout.includes('COMMANDS')
      expect(hasVerb, `no verb/option table found in ${group} --help`).toBe(
        true,
      )
    })
  })
})
