/* eslint-disable prefer-rest-params */
import cluster from 'cluster'

import { ConsoleLogger, ConsoleLoggerOptions } from '@nestjs/common'

export class MyLogger extends ConsoleLogger {
  constructor(context: string, options: ConsoleLoggerOptions) {
    super(context, options)
  }
  private _getColorByLogLevel(logLevel: string) {
    switch (logLevel) {
      case 'debug':
        return chalk.magentaBright
      case 'warn':
        return chalk.yellow
      case 'error':
        return chalk.red
      case 'verbose':
        return chalk.cyanBright
      default:
        return chalk.green
    }
  }

  private lastTimestampAt: number = Date.now()
  private _updateAndGetTimestampDiff() {
    const includeTimestamp = this.lastTimestampAt && this.options.timestamp
    const now = Date.now()
    const result = includeTimestamp
      ? chalk.yellow(` +${now - this.lastTimestampAt}ms`)
      : ''
    this.lastTimestampAt = now
    return result
  }
  protected formatMessage(message: any, logLevel = 'log') {
    const formatMessage =
      typeof message == 'string'
        ? this._getColorByLogLevel(logLevel)(message)
        : message
    return formatMessage
  }
  log(message: any, context?: string, ...argv: any[]) {
    this.print('info', message, context, ...argv)
  }

  warn(message: any, context?: string, ...argv: any[]) {
    this.print('warn', message, context, ...argv)
  }
  debug(message: any, context?: string, ...argv: any[]) {
    this.print('debug', message, context, ...argv)
  }

  verbose(message: any, context?: string, ...argv: any[]) {
    this.print('verbose', message, context, ...argv)
  }

  error(message: any, context?: string, ...argv: any[]) {
    const trace = context
    const _context = argv[0]

    if (!trace && _context) {
      this.print('error', message, _context, ...argv.slice(1))
    } else {
      this.print('error', message, context, ...argv)
    }
  }

  private print(level: string, message: any, context?: string, ...argv: any[]) {
    const print = consola[level]
    const formatMessage = this.formatMessage(message, level)
    const diff = this._updateAndGetTimestampDiff()

    const workerPrefix = cluster.isWorker
      ? chalk.hex('#fab1a0')(`*Worker - ${cluster!.worker!.id}*`)
      : ''
    if (context && !argv.length) {
      print(`${workerPrefix} [${chalk.yellow(context)}] `, formatMessage, diff)
    } else if (!argv.length) {
      print(`${workerPrefix} ${this.defaultContextPrefix}`, formatMessage, diff)
    } else {
      print(
        `${workerPrefix} ${this.defaultContextPrefix}`,
        message,
        context,
        ...argv,
        diff,
      )
    }
  }

  private defaultContextPrefix = this.context
    ? `[${chalk.yellow(this.context)}] `
    : `[${chalk.hex('#fd79a8')('System')}] `
}
