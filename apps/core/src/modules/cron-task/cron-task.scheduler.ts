import { Injectable, Logger } from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'

import { CronOnce } from '~/common/decorators/cron-once.decorator'

import { CronTaskService } from './cron-task.service'
import { CronTaskType, type CronTaskTypeValue } from './cron-task.types'

@Injectable()
export class CronTaskScheduler {
  private readonly logger = new Logger(CronTaskScheduler.name)

  constructor(private readonly cronTaskService: CronTaskService) {}

  private async dispatch(name: string, type: CronTaskTypeValue) {
    this.logger.log(`Scheduling ${name} task`)
    const result = await this.cronTaskService.createCronTask(type)
    this.logger.log(
      `${name} task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'cleanAccessRecord',
  })
  scheduleCleanAccessRecord() {
    return this.dispatch('cleanAccessRecord', CronTaskType.CleanAccessRecord)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'resetIPAccess' })
  scheduleResetIPAccess() {
    return this.dispatch('resetIPAccess', CronTaskType.ResetIPAccess)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'resetLikedOrReadArticleRecord',
  })
  scheduleResetLikedOrReadArticleRecord() {
    return this.dispatch(
      'resetLikedOrReadArticleRecord',
      CronTaskType.ResetLikedOrReadArticleRecord,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_3AM, { name: 'cleanTempDirectory' })
  scheduleCleanTempDirectory() {
    return this.dispatch('cleanTempDirectory', CronTaskType.CleanTempDirectory)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'pushToBaiduSearch' })
  schedulePushToBaiduSearch() {
    return this.dispatch('pushToBaiduSearch', CronTaskType.PushToBaiduSearch)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'pushToBingSearch' })
  schedulePushToBingSearch() {
    return this.dispatch('pushToBingSearch', CronTaskType.PushToBingSearch)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'deleteExpiredJWT' })
  scheduleDeleteExpiredJWT() {
    return this.dispatch('deleteExpiredJWT', CronTaskType.DeleteExpiredJWT)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_4AM, { name: 'rebuildSearchIndex' })
  scheduleRebuildSearchIndex() {
    return this.dispatch('rebuildSearchIndex', CronTaskType.RebuildSearchIndex)
  }

  @CronOnce('*/15 * * * *', { name: 'cleanCommentUploads' })
  async scheduleCleanCommentUploads() {
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.CleanCommentUploads,
    )
    if (result.created) {
      this.logger.log(`cleanCommentUploads task created: ${result.taskId}`)
    }
  }
}
