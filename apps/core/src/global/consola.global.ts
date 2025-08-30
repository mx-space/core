import { createLogger, Logger } from '@innei/pretty-logger-nestjs'
import { LOG_DIR } from '~/constants/path.constant'
import { isTest } from './env.global'

const logger = createLogger({
  writeToFile: !isTest
    ? {
        loggerDir: LOG_DIR,
        errWriteToStdout: true,
      }
    : undefined,
})
Logger.setLoggerInstance(logger)
if (!isTest) {
  try {
    logger.wrapAll()
  } catch {
    logger.warn('wrap console failed')
  }
  logger.onData((data) => {
    const { redisSubPub } = require('../utils/redis-subpub.util')
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
