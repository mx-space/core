import cluster from 'cluster'
import os from 'os'

export class Cluster {
  static register(workers: Number, callback: Function): void {
    if (cluster.isPrimary) {
      consola.info(`Primary server started on ${process.pid}`)

      //ensure workers exit cleanly
      process.on('SIGINT', function () {
        consola.info('Cluster shutting down...')
        for (const id in cluster.workers) {
          cluster.workers[id].kill()
        }
        // exit the master process
        process.exit(0)
      })

      const cpus = os.cpus().length
      if (workers > cpus) workers = cpus

      for (let i = 0; i < workers; i++) {
        cluster.fork()
      }
      cluster.on('online', function (worker) {
        consola.info('Worker %s is online', worker.process.pid)
      })
      cluster.on('exit', (worker, code, signal) => {
        consola.info(`Worker ${worker.process.pid} died. Restarting`)
        cluster.fork()
      })
    } else {
      callback()
    }
  }
}
