import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runAcrossModes } from '../../src/helpers/assert-view'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs skill search output modes', () => {
  let tmpHome: TmpHome

  beforeAll(() => {
    tmpHome = makeTmpHome()
  })

  afterAll(() => {
    tmpHome?.cleanup()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  it(
    'renders skill search "command" across readable / llm / xml',
    async () => {
      await runAcrossModes(
        ['skill', 'search', 'command'],
        env(),
        { llm: true, xml: true },
        {
          readable: (stdout) => {
            const clean = stdout.replace(/\x1b\[[0-9;]*m/g, '')
            expect(clean.toLowerCase()).toContain('command')
          },
          llm: (stdout) => {
            expect(stdout).toContain('# ')
            expect(stdout).toContain('\n\n---\n\n')
          },
          xml: (stdout) => {
            expect(stdout.trim()).toMatch(/^<hits>/)
            expect(stdout).toContain('<hit slug=')
          },
        },
      )
    },
    30_000,
  )
})
