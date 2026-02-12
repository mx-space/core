import { Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { StringIdDto } from '~/shared/dto/id.dto'
import { DeleteTasksQueryDto, GetTasksQueryDto } from './ai-task.dto'
import { AiTaskService } from './ai-task.service'

@ApiController('ai/tasks')
export class AiTaskController {
  constructor(private readonly service: AiTaskService) {}

  @Get('/group/:id')
  @Auth()
  async getTasksByGroupId(@Param() params: StringIdDto) {
    return this.service.getTasksByGroupId(params.id)
  }

  @Delete('/group/:id')
  @Auth()
  async cancelTasksByGroupId(@Param() params: StringIdDto) {
    const cancelled = await this.service.cancelTasksByGroupId(params.id)
    return { cancelled }
  }

  @Get('/:id')
  @Auth()
  async getTask(@Param() params: StringIdDto) {
    return this.service.getTask(params.id)
  }

  @Get('/')
  @Auth()
  async getTasks(@Query() query: GetTasksQueryDto) {
    return this.service.getTasks(query)
  }

  @Post('/:id/retry')
  @Auth()
  async retryTask(@Param() params: StringIdDto) {
    return this.service.retryTask(params.id)
  }

  @Post('/:id/cancel')
  @Auth()
  async cancelTask(@Param() params: StringIdDto) {
    await this.service.cancelTask(params.id)
    return { success: true }
  }

  @Delete('/:id')
  @Auth()
  async deleteTask(@Param() params: StringIdDto) {
    await this.service.deleteTask(params.id)
    return { success: true }
  }

  @Delete('/')
  @Auth()
  async deleteTasks(@Query() query: DeleteTasksQueryDto) {
    const deleted = await this.service.deleteTasks(query)
    return { deleted }
  }
}
