import { mkdirSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { chalk } from 'zx'

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
  Logger.log(chalk.blue(`数据目录已经建好：${DATA_DIR}`))
  mkdirSync(TEMP_DIR, { recursive: true })
  Logger.log(chalk.blue(`临时目录已经建好：${TEMP_DIR}`))
  mkdirSync(LOG_DIR, { recursive: true })
  Logger.log(chalk.blue(`日志目录已经建好：${LOG_DIR}`))
  mkdirSync(USER_ASSET_DIR, { recursive: true })
  Logger.log(chalk.blue(`资源目录已经建好：${USER_ASSET_DIR}`))
  mkdirSync(STATIC_FILE_DIR, { recursive: true })
  Logger.log(chalk.blue(`文件存放目录已经建好：${STATIC_FILE_DIR}`))
  mkdirSync(THEME_DIR, { recursive: true })
  const db = await MongoMemoryServer.create()
  await db.stop()
}
export async function teardown() {}
