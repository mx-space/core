import './dayjs.global'

import cluster from 'node:cluster'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import pc from 'picocolors'

import { CLUSTER } from '~/app.config'
import {
  DATA_DIR,
  STATIC_FILE_DIR,
  STATIC_FILE_TRASH_DIR,
  TEMP_DIR,
  USER_ASSET_DIR,
} from '~/constants/path.constant'

import { consola, globalLogger, logger } from './consola.global'
import { cwd, isDev } from './env.global'
import { registerJSONGlobal } from './json.global'

// Create application directories
function createAppFolders() {
  if (!CLUSTER.enable || cluster.isPrimary) {
    mkdirSync(DATA_DIR, { recursive: true })
    globalLogger.log(pc.blue(`Data directory ready: ${DATA_DIR}`))
    mkdirSync(TEMP_DIR, { recursive: true })
    globalLogger.log(pc.blue(`Temp directory ready: ${TEMP_DIR}`))
    mkdirSync(USER_ASSET_DIR, { recursive: true })
    globalLogger.log(pc.blue(`Asset directory ready: ${USER_ASSET_DIR}`))
    mkdirSync(STATIC_FILE_DIR, { recursive: true })
    globalLogger.log(pc.blue(`Static file directory ready: ${STATIC_FILE_DIR}`))
    mkdirSync(STATIC_FILE_TRASH_DIR, { recursive: true })
    globalLogger.log(
      pc.blue(`File trash directory ready: ${STATIC_FILE_TRASH_DIR}`),
    )

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
  Object.assign(globalThis, {
    isDev,
    consola,
    cwd,
  })
  // eslint-disable-next-line no-console
  console.debug = (...rest) => {
    if (isDev) {
      logger.log.call(console, ...rest)
    }
  }
}

function nodeEnvInjection() {
  // # https://github.com/kriszyp/cbor-x/blob/master/node-index.js#L16 https://github.com/kriszyp/cbor-x/blob/master/node-index.js#L10
  // # Bundled builds don't support runtime native requires; disable ACCELERATION
  process.env.CBOR_NATIVE_ACCELERATION_DISABLED = 'true'
}

export function initializeApp() {
  registerGlobal()
  nodeEnvInjection()
  registerJSONGlobal()
  createAppFolders()
}
