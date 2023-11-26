/* eslint-disable prefer-rest-params */

/* eslint-disable prefer-rest-params */
import { createLogger } from 'nestjs-pretty-logger'

import { LOG_DIR } from '~/constants/path.constant'

import { redisSubPub } from '../utils/redis-subpub.util'
import { isTest } from './env.global'

const logger = createLogger({
  writeToFile: {
    loggerDir: LOG_DIR,
  },
})

if (!isTest) {
  try {
    logger.wrapAll()
  } catch (error) {
    logger.warn('wrap console failed')
  }
  logger.onData((data) => {
    redisSubPub.publish('log', data)
  })
}

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

export { logger as consola, logger }
