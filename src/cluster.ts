import cluster from 'cluster'
import os from 'os'

export class Cluster {
  static register(workers: Number, callback: Function): void {
    if (cluster.isPrimary) {
      const cpus = os.cpus().length

      consola.info(`Primary server started on ${process.pid}`)
      consola.info('CPU:' + cpus)
      //ensure workers exit cleanly
      process.on('SIGINT', function () {
        consola.info('Cluster shutting down...')
        for (const id in cluster.workers) {
          cluster.workers[id].kill()
        }
        // exit the master process
        process.exit(0)
      })

      if (workers > cpus) workers = cpus

      for (let i = 0; i < workers; i++) {
        cluster.fork()
      }

      cluster.on('fork', function (worker) {
        worker.on('message', function (msg) {
          Object.keys(cluster.workers).forEach(function (id) {
            cluster.workers[id].send(msg)
          })
        })
      })

      cluster.on('online', function (worker) {
        consola.info('Worker %s is online', worker.process.pid)
      })
      cluster.on('exit', (worker, code, signal) => {
        if (code !== 0) {
          consola.info(`Worker ${worker.process.pid} died. Restarting`)
          cluster.fork()
        }
      })
    } else {
      callback()
    }
  }
}
