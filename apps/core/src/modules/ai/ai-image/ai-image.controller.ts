import { Body, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import { CreateCoverTaskDto } from '../ai-task/ai-task.dto'
import { AiTaskService } from '../ai-task/ai-task.service'

@ApiController('ai/images')
export class AiImageController {
  constructor(private readonly aiTaskService: AiTaskService) {}

  @Post('/covers/tasks')
  @Auth()
  async createCoverTask(@Body() body: CreateCoverTaskDto) {
    return this.aiTaskService.createCoverTask(body)
  }
}
