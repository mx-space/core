import { mkdirSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { Logger } from '@nestjs/common'

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
  const db = await MongoMemoryServer.create()
  await db.stop()
}
export async function teardown() {}
