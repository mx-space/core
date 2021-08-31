/* eslint-disable @typescript-eslint/no-empty-function */
import { Logger, LoggerService } from '@nestjs/common'

class LoggerModule implements LoggerService {
  logger: Logger
  constructor(context: string, options?: { timestamp?: boolean }) {
    this.logger = new Logger(context, options)
  }
  debug(...message: any[]) {
    // chalk.
    // this.logger.debug(message)
  }
  error(...message: any[]) {}
  log(...message: any[]) {}
  verbose(...message: any[]) {}
  warn(...message: any[]) {}
}
