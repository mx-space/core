import { Injectable, Logger } from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { CronTaskService } from './cron-task.service'
import { CronTaskType } from './cron-task.types'

@Injectable()
export class CronTaskScheduler {
  private readonly logger = new Logger(CronTaskScheduler.name)

  constructor(private readonly cronTaskService: CronTaskService) {}

  @CronOnce(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'cleanAccessRecord',
  })
  async scheduleCleanAccessRecord() {
    this.logger.log('Scheduling cleanAccessRecord task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.CleanAccessRecord,
    )
    this.logger.log(
      `cleanAccessRecord task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'resetIPAccess' })
  async scheduleResetIPAccess() {
    this.logger.log('Scheduling resetIPAccess task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.ResetIPAccess,
    )
    this.logger.log(
      `resetIPAccess task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'resetLikedOrReadArticleRecord',
  })
  async scheduleResetLikedOrReadArticleRecord() {
    this.logger.log('Scheduling resetLikedOrReadArticleRecord task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.ResetLikedOrReadArticleRecord,
    )
    this.logger.log(
      `resetLikedOrReadArticleRecord task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_3AM, { name: 'cleanTempDirectory' })
  async scheduleCleanTempDirectory() {
    this.logger.log('Scheduling cleanTempDirectory task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.CleanTempDirectory,
    )
    this.logger.log(
      `cleanTempDirectory task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'pushToBaiduSearch' })
  async schedulePushToBaiduSearch() {
    this.logger.log('Scheduling pushToBaiduSearch task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.PushToBaiduSearch,
    )
    this.logger.log(
      `pushToBaiduSearch task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'pushToBingSearch' })
  async schedulePushToBingSearch() {
    this.logger.log('Scheduling pushToBingSearch task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.PushToBingSearch,
    )
    this.logger.log(
      `pushToBingSearch task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'deleteExpiredJWT' })
  async scheduleDeleteExpiredJWT() {
    this.logger.log('Scheduling deleteExpiredJWT task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.DeleteExpiredJWT,
    )
    this.logger.log(
      `deleteExpiredJWT task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_HOUR, { name: 'cleanupOrphanImages' })
  async scheduleCleanupOrphanImages() {
    this.logger.log('Scheduling cleanupOrphanImages task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.CleanupOrphanImages,
    )
    this.logger.log(
      `cleanupOrphanImages task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }

  @CronOnce(CronExpression.EVERY_HOUR, { name: 'syncPublishedImagesToS3' })
  async scheduleSyncPublishedImagesToS3() {
    this.logger.log('Scheduling syncPublishedImagesToS3 task')
    const result = await this.cronTaskService.createCronTask(
      CronTaskType.SyncPublishedImagesToS3,
    )
    this.logger.log(
      `syncPublishedImagesToS3 task ${result.created ? 'created' : 'already exists'}: ${result.taskId}`,
    )
  }
}
