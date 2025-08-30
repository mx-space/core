#!env node
// register global
import cluster from 'node:cluster'
import { cpus } from 'node:os'
import { argv } from '@mx-space/compiled'
import { DEBUG_MODE } from './app.config'
import { registerForMemoryDump } from './dump'
import { logger } from './global/consola.global'
import { isMainCluster, isMainProcess } from './global/env.global'
import { initializeApp } from './global/index.global'
import { migrateDatabase } from './migration/migrate'

process.title = `Mix Space (${cluster.isPrimary ? 'master' : 'worker'}) - ${
  process.env.NODE_ENV
}`

async function main() {
  initializeApp()

  if (isMainProcess) {
    await migrateDatabase()
  }

  const [{ bootstrap }, { CLUSTER, ENCRYPT }, { Cluster }] = await Promise.all([
    import('./bootstrap'),
    import('./app.config'),
    import('./cluster'),
  ])

  if (!CLUSTER.enable || cluster.isPrimary || isMainCluster) {
    logger.debug(argv)
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

main()
