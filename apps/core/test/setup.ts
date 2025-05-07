import { mkdirSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { RedisMemoryServer } from 'redis-memory-server'

import {
  DATA_DIR,
  LOG_DIR,
  STATIC_FILE_DIR,
  TEMP_DIR,
  THEME_DIR,
  USER_ASSET_DIR,
} from '~/constants/path.constant'

export async function setup() {
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(TEMP_DIR, { recursive: true })
  mkdirSync(LOG_DIR, { recursive: true })
  mkdirSync(USER_ASSET_DIR, { recursive: true })
  mkdirSync(STATIC_FILE_DIR, { recursive: true })
  mkdirSync(THEME_DIR, { recursive: true })

  // Initialize Redis and MongoDB mock server
  await Promise.all([
    RedisMemoryServer.create(),
    MongoMemoryServer.create(),
  ]).then(async ([redis, db]) => {
    await redis.stop()
    await db.stop()
  })
}
export async function teardown() {}
