/* eslint-disable prefer-rest-params */

/* eslint-disable prefer-rest-params */
import { createLogger } from 'nestjs-pretty-logger'

import { LOG_DIR } from '~/constants/path.constant'

import { redisSubPub } from '../utils/redis-subpub.util'

const logger = createLogger({
  writeToFile: {
    loggerDir: LOG_DIR,
  },
})
logger.wrapAll()
logger.onData((data) => {
  redisSubPub.publish('log', data)
})

// HACK: forhidden pm2 to override this method
Object.defineProperty(process.stdout, 'write', {
  value: process.stdout.write,
  writable: false,
  configurable: false,
})
Object.defineProperty(process.stderr, 'write', {
  value: process.stdout.write,
  writable: false,
  configurable: false,
})

export { logger as consola }
