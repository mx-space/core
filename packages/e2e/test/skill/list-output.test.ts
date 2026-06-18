import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runAcrossModes } from '../../src/helpers/assert-view'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

// `mxs skill` reads bundled markdown without touching the server, so no
// MXS_PROFILE is needed; the isolated XDG_CONFIG_HOME is enough.
describe('mxs skill list output modes', () => {
  let tmpHome: TmpHome

  beforeAll(() => {
    tmpHome = makeTmpHome()
  })

  afterAll(() => {
    tmpHome?.cleanup()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  it(
    'renders skill list across readable / llm / xml',
    async () => {
      await runAcrossModes(
        ['skill', 'list'],
        env(),
        { llm: true, xml: true },
        {
          readable: (stdout) => {
            const clean = stdout.replace(/\x1b\[[0-9;]*m/g, '')
            expect(clean).toContain('overview')
          },
          llm: (stdout) => {
            const lines = stdout.trim().split('\n')
            const hasTabSeparated = lines.some((l) => l.includes('\t'))
            expect(hasTabSeparated).toBe(true)
            expect(stdout).toContain('overview')
          },
          xml: (stdout) => {
            expect(stdout.trim()).toMatch(/^<chapters>/)
            expect(stdout).toContain('<chapter slug="overview"')
          },
        },
      )
    },
    30_000,
  )
})
