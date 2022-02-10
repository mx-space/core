import { CronExpression } from '@nestjs/schedule'
import consola_, {
  ConsolaReporterArgs,
  ConsolaReporterLogObject,
  FancyReporter,
  LogLevel,
} from 'consola'
import { CronJob } from 'cron'
import dayjs from 'dayjs'
import { createWriteStream, WriteStream } from 'fs'
import { resolve } from 'path'
import { argv } from 'zx'
import { LOG_DIR } from '~/constants/path.constant'
import type { RedisSubPub } from './redis-subpub.util'
import { isDev, isTest } from './tool.util'

export const getTodayLogFilePath = () =>
  resolve(LOG_DIR, 'stdout_' + dayjs().format('YYYY-MM-DD') + '.log')
class DateTimeReporter extends FancyReporter {
  private fs: WriteStream
  private job: CronJob
  constructor() {
    super()

    this.fs = createWriteStream(getTodayLogFilePath(), {
      encoding: 'utf-8',
      flags: 'a+',
    })

    this.fs.write(
      '\n========================================================\n',
    )

    this.job = new CronJob(CronExpression.EVERY_DAY_AT_MIDNIGHT, () => {
      this.fs.close()

      this.fs = createWriteStream(getTodayLogFilePath(), {
        encoding: 'utf-8',
        flags: 'a+',
      })
      this.fs.write(
        '\n========================================================\n',
      )
    })
  }
  formatDate(date: Date) {
    return date.toLocaleString(undefined, {
      hour12: false,
      timeStyle: 'medium',
      dateStyle: 'short',
    })
  }

  subpub: RedisSubPub
  public log(logObj: ConsolaReporterLogObject, args: ConsolaReporterArgs) {
    super.log(logObj, args)

    if (!isTest) {
      ;(async () => {
        this.subpub =
          this.subpub || (await import('./redis-subpub.util')).redisSubPub

        const formatOutput =
          `${chalk.gray(dayjs().format('HH:mm:ss'))} ` +
          // @ts-expect-error
          super.formatLogObj(logObj, { width: args.columns || 0 }) +
          '\n'
        if (this.fs) {
          this.fs.write(formatOutput)
        }
        this.subpub.publish('log', formatOutput)
      })()
    }
  }
}
const consola = consola_.create({
  reporters: [new DateTimeReporter()],
  level: isDev || argv.verbose ? LogLevel.Trace : LogLevel.Info,
})
// HINT: must be called before any other log calls, export it in the end of your file
consola.wrapAll()
export { consola }
