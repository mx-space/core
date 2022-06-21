import {
  BadRequestException,
  Body,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { OffsetDto } from '~/shared/dto/pager.dto'

import { RecentlyModel } from './recently.model'
import { RecentlyService } from './recently.service'

@ApiController(['recently', 'shorthand'])
@ApiName
export class RecentlyController {
  constructor(private readonly recentlyService: RecentlyService) {}

  @Get('/latest')
  async getLatestOne() {
    return await this.recentlyService.getLatestOne()
  }

  @Get('/all')
  getAll() {
    return this.recentlyService.getAll()
  }

  @Get('/')
  async getList(@Query() query: OffsetDto) {
    const { before, after, size } = query

    if (before && after) {
      throw new BadRequestException('you can only choose `before` or `after`')
    }

    return await this.recentlyService.getOffset({ before, after, size })
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  async create(@Body() body: RecentlyModel) {
    const res = await this.recentlyService.create(body)

    return res
  }

  @Delete('/:id')
  @Auth()
  async del(@Param() { id }: MongoIdDto) {
    const res = await this.recentlyService.delete(id)
    if (!res) {
      throw new BadRequestException('删除失败, 条目不存在')
    }

    return
  }
}
