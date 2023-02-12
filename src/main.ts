#!env node
// register global
import cluster from 'cluster'

import { isMainCluster } from './global/env.global'
import { register } from './global/index.global'

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
    consola.debug(argv)
    consola.log('cwd: ', cwd)
  }

  if (ENCRYPT.enable && ENCRYPT.key) {
    const isValidKey = ENCRYPT.key.length === 64

    if (!isValidKey) {
      consola.error('encrypt key must be 64 length')
      process.exit(1)
    }

    consola.debug('encrypt key: ', ENCRYPT.key)
    consola.warn(
      `Encrypt is enabled, please remember encrypt key. Your key is starts with ${ENCRYPT.key.slice(
        0,
        3,
      )}`,
    )
  }

  if (CLUSTER.enable) {
    Cluster.register(parseInt(CLUSTER.workers) || os.cpus().length, bootstrap)
  } else {
    bootstrap()
  }
}

main()
