import { createLogger, Logger } from '@innei/pretty-logger-nestjs'
import { isTest } from './env.global'

const logger = createLogger()
Logger.setLoggerInstance(logger)
if (!isTest) {
  try {
    logger.wrapAll()
  } catch {
    logger.warn('wrap console failed')
  }
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

// Global Logger instance for static-like usage
const globalLogger = new Logger('System')

export { logger as consola, globalLogger, logger }
