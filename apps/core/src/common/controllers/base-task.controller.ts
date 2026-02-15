import { Delete, Get, Param, Post, Query } from '@nestjs/common'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { ScopedTaskService } from '~/processors/task-queue/scoped-task.service'
import { StringIdDto } from '~/shared/dto/id.dto'
import { BaseDeleteTasksQueryDto, BaseGetTasksQueryDto } from './base-task.dto'

export abstract class BaseTaskController {
  protected abstract get taskCrudService(): ScopedTaskService

  @Get('/:id')
  @Auth()
  async getTask(@Param() params: StringIdDto) {
    const task = await this.taskCrudService.getTask(params.id)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }
    return task
  }

  @Get('/')
  @Auth()
  async getTasks(@Query() query: BaseGetTasksQueryDto) {
    return this.taskCrudService.getTasks(query)
  }

  @Post('/:id/cancel')
  @Auth()
  async cancelTask(@Param() params: StringIdDto) {
    await this.taskCrudService.cancelTask(params.id)
    return { success: true }
  }

  @Post('/:id/retry')
  @Auth()
  async retryTask(@Param() params: StringIdDto) {
    return this.taskCrudService.retryTask(params.id)
  }

  @Delete('/:id')
  @Auth()
  async deleteTask(@Param() params: StringIdDto) {
    await this.taskCrudService.deleteTask(params.id)
    return { success: true }
  }

  @Delete('/')
  @Auth()
  async deleteTasks(@Query() query: BaseDeleteTasksQueryDto) {
    const deleted = await this.taskCrudService.deleteTasks(query)
    return { deleted }
  }
}
