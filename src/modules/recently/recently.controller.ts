import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { Auth } from '~/common/decorator/auth.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { OffsetDto } from '~/shared/dto/pager.dto'
import { RecentlyModel } from './recently.model'
import { RecentlyService } from './recently.service'

@Controller('recently')
@ApiName
export class RecentlyController {
  constructor(private readonly recentlyService: RecentlyService) {}

  @Get('/latest')
  async getLatestOne() {
    return await this.recentlyService.getLatestOne()
  }

  @Get('/')
  async getList(@Query() query: OffsetDto) {
    const { before, after, size } = query

    if (before && after) {
      throw new BadRequestException('before or after must choice one')
    }

    return await this.recentlyService.getOffset({ before, after, size })
  }

  @Post('/')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: RecentlyModel) {
    const res = await this.recentlyService.create(body)

    return res
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async del(@Param() { id }: MongoIdDto) {
    const res = await this.recentlyService.delete(id)
    if (!res) {
      throw new BadRequestException('删除失败, 条目不存在')
    }

    return
  }
}
