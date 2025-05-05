import cluster from 'node:cluster'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { Logger } from '@nestjs/common'

import { CLUSTER } from '~/app.config'
import {
  DATA_DIR,
  LOG_DIR,
  STATIC_FILE_DIR,
  STATIC_FILE_TRASH_DIR,
  TEMP_DIR,
  USER_ASSET_DIR,
} from '~/constants/path.constant'

import { consola, logger } from './consola.global'
import { cwd, isDev } from './env.global'
import { registerJSONGlobal } from './json.global'

import './dayjs.global'

import { $, chalk } from '@mx-space/compiled'

// 建立目录
function createAppFolders() {
  if (!CLUSTER.enable || cluster.isPrimary) {
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
    mkdirSync(STATIC_FILE_TRASH_DIR, { recursive: true })
    Logger.log(chalk.blue(`文件回收站目录已经建好：${STATIC_FILE_TRASH_DIR}`))

    const packageJSON = `${DATA_DIR}/package.json`
    const hasPKG = existsSync(packageJSON)
    if (!hasPKG) {
      writeFileSync(packageJSON, '{"name":"modules"}', {
        flag: 'a',
      })
    }
  }
}

function registerGlobal() {
  $.verbose = isDev
  Object.assign(globalThis, {
    isDev,
    consola,
    cwd,
  })
  console.debug = (...rest) => {
    if (isDev) {
      logger.log.call(console, ...rest)
    }
  }
}

function nodeEnvInjection() {
  // # https://github.com/kriszyp/cbor-x/blob/master/node-index.js#L16 https://github.com/kriszyp/cbor-x/blob/master/node-index.js#L10
  // # ncc not support runtime require so disable ACCELERATION
  process.env.CBOR_NATIVE_ACCELERATION_DISABLED = 'true'
}

export function initializeApp() {
  registerGlobal()
  nodeEnvInjection()
  registerJSONGlobal()
  createAppFolders()
}
