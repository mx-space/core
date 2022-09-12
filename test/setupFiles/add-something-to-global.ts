// @ts-nocheck
import { beforeAll } from 'vitest'

import 'zx/globals'

beforeAll(async () => {
  await import('zx/globals')

  global.isDev = true
  global.cwd = process.cwd()
})

beforeEach(() => {
  global.isDev = true
  global.cwd = process.cwd()
})
