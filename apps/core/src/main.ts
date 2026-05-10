#!env node
// register global
import 'dotenv-expand/config'

import cluster from 'node:cluster'
import { cpus } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEBUG_MODE } from './app.config.js'
import { registerForMemoryDump } from './dump'
import { logger } from './global/consola.global'
import { isMainCluster } from './global/env.global'
import { initializeApp } from './global/index.global'

process.title = `Mix Space (${cluster.isPrimary ? 'master' : 'worker'}) - ${
  process.env.NODE_ENV
}`

export async function startMain() {
  initializeApp()

  const [{ bootstrap }, { CLUSTER, ENCRYPT }, { Cluster }] = await Promise.all([
    import('./bootstrap'),
    import('./app.config.js'),
    import('./cluster'),
  ])

  if (!CLUSTER.enable || cluster.isPrimary || isMainCluster) {
    logger.debug(process.argv)
    logger.log('cwd: ', cwd)
  }

  if (ENCRYPT.enable && ENCRYPT.key) {
    const isValidKey = ENCRYPT.key.length === 64

    if (!isValidKey) {
      logger.error('encrypt key must be 64 length')
      process.exit(1)
    }

    logger.debug('encrypt key: ', ENCRYPT.key)
    logger.log(
      `Encrypt is enabled, please remember encrypt key. Your key is starts with ${ENCRYPT.key.slice(
        0,
        3,
      )}`,
    )
  }

  DEBUG_MODE.memoryDump && registerForMemoryDump()
  if (CLUSTER.enable) {
    Cluster.register(
      Number.parseInt(CLUSTER.workers) || cpus().length,
      bootstrap,
    )
  } else {
    bootstrap()
  }
}

function isCliEntry(): boolean {
  try {
    const here = fileURLToPath(import.meta.url)
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : ''
    return here === entry
  } catch {
    return false
  }
}

if (isCliEntry()) {
  startMain()
}
