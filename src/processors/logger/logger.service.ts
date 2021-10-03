/* eslint-disable prefer-rest-params */
import { ConsoleLogger, ConsoleLoggerOptions } from '@nestjs/common'
import { performance } from 'perf_hooks'

export class MyLogger extends ConsoleLogger {
  constructor(context?: string, options?: ConsoleLoggerOptions) {
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

  private lastTimestampAt: number = performance.now() | 0
  private _updateAndGetTimestampDiff() {
    const includeTimestamp = this.lastTimestampAt && this.options.timestamp
    const now = performance.now() | 0
    const result = includeTimestamp
      ? chalk.yellow(` +${now - this.lastTimestampAt}ms`)
      : ''
    this.lastTimestampAt = now
    return result
  }
  private formatMessage(message: any, logLevel = 'log') {
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

  error(message: any, trace?: string, context?: string) {
    const formatMessage = this.formatMessage(message, 'debug')
    if (context) {
      consola.error(`[${chalk.yellow(context)}] `, formatMessage)
    } else {
      consola.error(this.defaultContextPrefix, formatMessage)
    }
    if (trace) {
      consola.trace(trace)
    }
  }

  private print(level: string, message: any, context?: string, ...argv: any[]) {
    const print = consola[level]
    const formatMessage = this.formatMessage(message, level)
    const diff = this._updateAndGetTimestampDiff()
    if (context && !argv.length) {
      print(`[${chalk.yellow(context)}] `, formatMessage, diff)
    } else if (!argv.length) {
      print(this.defaultContextPrefix, formatMessage, diff)
    } else {
      print(this.defaultContextPrefix, message, context, ...argv, diff)
    }
  }

  private defaultContextPrefix = this.context
    ? `[${chalk.yellow(this.context)}] `
    : `[${chalk.hex('#fd79a8')('MixSpaceServer')}] `
}
