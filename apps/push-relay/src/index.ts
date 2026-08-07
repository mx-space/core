import { Pool } from 'pg'

import { Http2ApnsProvider } from './apns-provider.js'
import { loadConfig } from './config.js'
import { DeliveryWorker } from './delivery-worker.js'
import { createPushRelayServer } from './http-server.js'
import { PostgresPushRelayStore } from './postgres-store.js'
import { PushRelayService } from './relay-service.js'

const config = loadConfig()
const pool = new Pool({ connectionString: config.databaseUrl })
const store = new PostgresPushRelayStore(pool)
const service = new PushRelayService(store, config)
const worker = new DeliveryWorker(
  store,
  new Http2ApnsProvider(config.apps),
  config.dataKey,
)
const server = createPushRelayServer(service)

server.listen(config.port, () => {
  console.info(`Push Relay listening on ${config.publicUrl}`)
  worker.start()
})

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  worker.stop()
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  await pool.end()
}

const requestShutdown = () => {
  void shutdown().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

process.once('SIGINT', requestShutdown)
process.once('SIGTERM', requestShutdown)
