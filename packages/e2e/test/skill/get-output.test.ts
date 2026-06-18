import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runAcrossModes } from '../../src/helpers/assert-view'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs skill get output modes', () => {
  let tmpHome: TmpHome

  beforeAll(() => {
    tmpHome = makeTmpHome()
  })

  afterAll(() => {
    tmpHome?.cleanup()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  it(
    'renders skill get overview across readable / llm / xml',
    async () => {
      await runAcrossModes(
        ['skill', 'get', 'overview'],
        env(),
        { llm: true, xml: true },
        {
          readable: (stdout) => {
            const ansiPattern = new RegExp(
              `${String.fromCharCode(27)}\\[[0-9;]*m`,
              'g',
            )
            const clean = stdout.replace(ansiPattern, '')
            expect(clean.length).toBeGreaterThan(0)
            expect(clean.toLowerCase()).toMatch(/skill\s+bundle|mxs/)
          },
          llm: (stdout) => {
            expect(stdout.trim().length).toBeGreaterThan(0)
            expect(stdout.toLowerCase()).toMatch(/skill\s+bundle|mxs/)
          },
          xml: (stdout) => {
            expect(stdout.trim()).toMatch(/^<chapter slug="overview"/)
          },
        },
      )
    },
    30_000,
  )
})
