import { mkdirSync } from 'node:fs'

import { RedisMemoryServer } from 'redis-memory-server'

import {
  DATA_DIR,
  STATIC_FILE_DIR,
  TEMP_DIR,
  THEME_DIR,
  USER_ASSET_DIR,
} from '~/constants/path.constant'

import {
  startPgTestContainer,
  stopPgTestContainer,
} from './helper/pg-testcontainer'

export async function setup() {
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(TEMP_DIR, { recursive: true })
  mkdirSync(USER_ASSET_DIR, { recursive: true })
  mkdirSync(STATIC_FILE_DIR, { recursive: true })
  mkdirSync(THEME_DIR, { recursive: true })

  // Initialize Redis and PostgreSQL test container.
  await Promise.all([RedisMemoryServer.create(), startPgTestContainer()]).then(
    async ([redis]) => {
      await redis.stop()
    },
  )
}
export async function teardown() {
  await stopPgTestContainer()
}
