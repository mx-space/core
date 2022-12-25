// @ts-nocheck
import { beforeAll } from 'vitest'

import 'zx/globals'

import consola from 'consola'

beforeAll(async () => {
  await import('zx/globals')

  global.isDev = true
  global.cwd = process.cwd()
  global.consola = consola
})

beforeEach(() => {
  global.isDev = true
  global.cwd = process.cwd()
  global.consola = consola
})
