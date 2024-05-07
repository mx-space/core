#!env node
// register global
import cluster from 'node:cluster'

import { logger } from './global/consola.global'
import { isMainCluster } from './global/env.global'
import { register } from './global/index.global'
import { registerForMemoryDump } from './dump'
import { DEBUG_MODE } from './app.config'

process.title = `Mix Space (${cluster.isPrimary ? 'master' : 'worker'}) - ${
  process.env.NODE_ENV
}`

async function main() {
  register()
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
    logger.warn(
      `Encrypt is enabled, please remember encrypt key. Your key is starts with ${ENCRYPT.key.slice(
        0,
        3,
      )}`,
    )
  }

  DEBUG_MODE.memoryDump && registerForMemoryDump()
  if (CLUSTER.enable) {
    Cluster.register(
      Number.parseInt(CLUSTER.workers) || os.cpus().length,
      bootstrap,
    )
  } else {
    bootstrap()
  }
}

main()
