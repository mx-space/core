import { configureAiEnvironment } from '@mx-space/ai'
import { Logger } from '@nestjs/common'

import { isDev } from './env.global'

export function registerAiEnvironment() {
  const loggers = new Map<string, Logger>()
  configureAiEnvironment({
    debug: isDev,
    loggerFactory: (context) => {
      let logger = loggers.get(context)
      if (!logger) {
        logger = new Logger(context)
        loggers.set(context, logger)
      }
      return logger
    },
  })
}
