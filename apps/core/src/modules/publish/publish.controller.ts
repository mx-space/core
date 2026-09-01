import { Body, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import {
  type CreatePublishJobDto,
  CreatePublishJobSchema,
} from './publish.schema'
import { PublishService } from './publish.service'

@ApiController('publish-jobs')
@Auth()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post('/')
  create(@Body({ schema: CreatePublishJobSchema }) body: CreatePublishJobDto) {
    return this.publishService.create(body)
  }
}
