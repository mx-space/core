import { mkdirSync } from 'node:fs'

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
import {
  findRedisSystemBinary,
  startTestRedis,
} from './helper/redis-test-server'

export async function setup() {
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(TEMP_DIR, { recursive: true })
  mkdirSync(USER_ASSET_DIR, { recursive: true })
  mkdirSync(STATIC_FILE_DIR, { recursive: true })
  mkdirSync(THEME_DIR, { recursive: true })

  // Initialize Redis and PostgreSQL test container.
  const systemBinary = findRedisSystemBinary()
  await Promise.all([
    startTestRedis({ binary: systemBinary ? { systemBinary } : undefined }),
    startPgTestContainer(),
  ]).then(async ([redis]) => {
    await redis.stop()
  })
}
export async function teardown() {
  await stopPgTestContainer()
}
