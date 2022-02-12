// register global
import { register } from './global/index.global'

async function main() {
  register()
  const [{ bootstrap }, { CLUSTER }, { Cluster }] = await Promise.all([
    import('./bootstrap'),
    import('./app.config'),
    import('./cluster'),
  ])

  if (CLUSTER.enable) {
    Cluster.register(parseInt(CLUSTER.workers) || os.cpus().length, bootstrap)
  } else {
    bootstrap()
  }
}

main()
