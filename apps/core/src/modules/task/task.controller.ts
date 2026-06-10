import { Delete, Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { TaskQueueService } from '~/processors/task-queue'
import { StringIdDto } from '~/shared/dto/id.dto'

import { DeleteTasksQueryDto, GetTasksQueryDto } from './task.dto'

@ApiController('tasks')
@Auth()
export class TaskController {
  constructor(private readonly taskQueueService: TaskQueueService) {}

  @Get('/')
  async getTasks(@Query() query: GetTasksQueryDto) {
    const result = await this.taskQueueService.getTasks(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder()
        .pagination({
          page: query.page,
          size: query.size,
          total: result.total,
          totalPages: Math.ceil(result.total / query.size),
        })
        .build(),
    )
  }

  @Get('/group/:id')
  async getTasksByGroupId(@Param() params: StringIdDto) {
    return this.taskQueueService.getTasksByGroupId(params.id)
  }

  @Delete('/group/:id')
  async cancelTasksByGroupId(@Param() params: StringIdDto) {
    const cancelled = await this.taskQueueService.cancelTasksByGroupId(
      params.id,
    )
    return { cancelled }
  }

  @Get('/:id')
  async getTask(@Param() params: StringIdDto) {
    const task = await this.taskQueueService.getTask(params.id)
    if (!task) {
      throw createAppException(AppErrorCode.TASK_NOT_FOUND, { id: params.id })
    }
    return task
  }

  @Post('/:id/cancel')
  async cancelTask(@Param() params: StringIdDto) {
    await this.taskQueueService.cancelTask(params.id)
    return { success: true }
  }

  @Post('/:id/retry')
  async retryTask(@Param() params: StringIdDto) {
    return this.taskQueueService.retryTask(params.id)
  }

  @Delete('/:id')
  async deleteTask(@Param() params: StringIdDto) {
    await this.taskQueueService.deleteTask(params.id)
    return { success: true }
  }

  @Delete('/')
  async deleteTasks(@Query() query: DeleteTasksQueryDto) {
    const deleted = await this.taskQueueService.deleteTasks(query)
    return { deleted }
  }
}
