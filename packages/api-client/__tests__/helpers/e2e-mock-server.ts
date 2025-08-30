import type { AddressInfo } from 'node:net'
import cors from 'cors'
import express from 'express'

type Express = ReturnType<typeof express>
export const createMockServer = (options: { port?: number } = {}) => {
  const { port = 0 } = options

  const app: Express = express()
  app.use(express.json())
  app.use(cors())
  const server = app.listen(port)

  return {
    app,
    port: (server.address() as AddressInfo).port,
    server,
    close() {
      server.close()
    },
  }
}
