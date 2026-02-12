import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'
import { isString } from '~/utils/validator.util'
import { CronTaskService } from './cron-task.service'
import { CronTaskType, type CronTaskTypeValue } from './cron-task.types'

@ApiController('cron-task')
@Auth()
export class CronTaskController {
  constructor(private readonly cronTaskService: CronTaskService) {}

  @Get('/')
  @HTTPDecorators.Bypass
  async getCronDefinitions() {
    return this.cronTaskService.getCronDefinitions()
  }

  @Get('/tasks')
  @HTTPDecorators.Bypass
  async getTasks(
    @Query('status') status?: TaskStatus,
    @Query('type') type?: CronTaskTypeValue,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.cronTaskService.getTasks({
      status,
      type,
      page: page ? Number.parseInt(page, 10) : 1,
      size: size ? Number.parseInt(size, 10) : 50,
    })
  }

  @Get('/tasks/:taskId')
  @HTTPDecorators.Bypass
  async getTask(@Param('taskId') taskId: string) {
    if (!isString(taskId)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'taskId must be string',
      )
    }
    const task = await this.cronTaskService.getTask(taskId)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }
    return task
  }

  @Post('/run/:type')
  async runCronTask(@Param('type') type: string) {
    if (!isString(type)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'type must be string',
      )
    }

    const validTypes = Object.values(CronTaskType) as string[]
    if (!validTypes.includes(type)) {
      throw new BizException(ErrorCodeEnum.CronNotFound, type)
    }

    return this.cronTaskService.createCronTask(type as CronTaskTypeValue)
  }

  @Post('/tasks/:taskId/cancel')
  async cancelTask(@Param('taskId') taskId: string) {
    if (!isString(taskId)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'taskId must be string',
      )
    }
    const success = await this.cronTaskService.cancelTask(taskId)
    return { success }
  }

  @Post('/tasks/:taskId/retry')
  async retryTask(@Param('taskId') taskId: string) {
    if (!isString(taskId)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'taskId must be string',
      )
    }
    return this.cronTaskService.retryTask(taskId)
  }

  @Delete('/tasks/:taskId')
  async deleteTask(@Param('taskId') taskId: string) {
    if (!isString(taskId)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'taskId must be string',
      )
    }
    await this.cronTaskService.deleteTask(taskId)
    return { success: true }
  }

  @Delete('/tasks')
  async deleteTasks(
    @Body()
    body: {
      status?: TaskStatus
      type?: CronTaskTypeValue
      before: number
    },
  ) {
    const deleted = await this.cronTaskService.deleteTasks(body)
    return { deleted }
  }
}
