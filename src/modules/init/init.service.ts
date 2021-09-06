import { Injectable, Logger } from '@nestjs/common'
import chalk from 'chalk'
import { mkdirSync } from 'fs'
import { DATA_DIR, LOGGER_DIR, TEMP_DIR } from '~/constants/path.constant'

@Injectable()
export class InitService {
  private logger = new Logger(InitService.name)
  constructor() {
    this.initDirs()
  }

  getTempdir() {
    return TEMP_DIR
  }

  getDatadir() {
    return DATA_DIR
  }

  initDirs() {
    mkdirSync(DATA_DIR, { recursive: true })
    this.logger.log(chalk.blue('数据目录已经建好: ' + DATA_DIR))
    mkdirSync(TEMP_DIR, { recursive: true })
    this.logger.log(chalk.blue('临时目录已经建好: ' + TEMP_DIR))
    mkdirSync(LOGGER_DIR, { recursive: true })
    this.logger.log(chalk.blue('日志目录已经建好: ' + LOGGER_DIR))
  }
}
