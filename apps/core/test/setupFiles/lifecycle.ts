// @ts-nocheck
import { beforeAll } from 'vitest'

import 'zx/globals'

import { dbHelper } from 'test/helper/db-mock.helper'
import { redisHelper } from 'test/helper/redis-mock.helper'

import { registerJSONGlobal } from '~/global/json.global'

beforeAll(async () => {
  await import('zx/globals')

  global.isDev = true
  global.cwd = process.cwd()
  global.consola = console

  registerJSONGlobal()
})

afterAll(async () => {
  await dbHelper.clear()
  await dbHelper.close()
  await (await redisHelper).close()
})

beforeAll(async () => {
  await dbHelper.connect()
  await redisHelper
})

beforeEach(() => {
  global.isDev = true
  global.cwd = process.cwd()
  global.consola = consola
})
