import { Delete, Get, Param } from '@nestjs/common'
import { BaseTaskController } from '~/common/controllers/base-task.controller'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import type { ScopedTaskService } from '~/processors/task-queue'
import { StringIdDto } from '~/shared/dto/id.dto'
import { AiTaskService } from './ai-task.service'

@ApiController('ai/tasks')
export class AiTaskController extends BaseTaskController {
  constructor(private readonly service: AiTaskService) {
    super()
  }

  protected get taskCrudService(): ScopedTaskService {
    return this.service.crud
  }

  @Get('/group/:id')
  @Auth()
  async getTasksByGroupId(@Param() params: StringIdDto) {
    return this.service.crud.getTasksByGroupId(params.id)
  }

  @Delete('/group/:id')
  @Auth()
  async cancelTasksByGroupId(@Param() params: StringIdDto) {
    const cancelled = await this.service.crud.cancelTasksByGroupId(params.id)
    return { cancelled }
  }
}
