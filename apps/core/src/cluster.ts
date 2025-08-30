import cluster from 'node:cluster'
import os from 'node:os'
import { logger } from './global/consola.global'

export const Cluster = {
  register(workers: number, callback: Function): void {
    if (cluster.isPrimary) {
      const cpus = os.cpus().length

      logger.info(`Primary server started on ${process.pid}`)
      logger.info(`CPU:${cpus}`)
      // ensure workers exit cleanly
      process.on('SIGINT', () => {
        logger.info('Cluster shutting down...')
        for (const id in cluster.workers) {
          cluster.workers[id]?.kill()
        }
        // exit the master process
        process.exit(0)
      })

      if (workers > cpus) workers = cpus

      for (let i = 0; i < workers; i++) {
        cluster.fork()
      }

      cluster.on('fork', (worker) => {
        worker.on('message', (msg) => {
          cluster.workers &&
            Object.keys(cluster.workers).forEach((id) => {
              cluster.workers?.[id]?.send(msg)
            })
        })
      })

      cluster.on('online', (worker) => {
        logger.info('Worker %s is online', worker.process.pid)
      })
      cluster.on('exit', (worker, code, _signal) => {
        if (code !== 0) {
          logger.info(`Worker ${worker.process.pid} died. Restarting`)
          cluster.fork()
        }
      })
    } else {
      callback()
    }
  },
}
