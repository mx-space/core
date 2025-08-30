import {
  BadRequestException,
  Body,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { OffsetDto } from '~/shared/dto/pager.dto'
import { RecentlyAttitudeDto } from './recently.dto'
import { RecentlyModel } from './recently.model'
import { RecentlyService } from './recently.service'

@ApiController(['recently', 'shorthand'])
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

  @Get('/:id')
  async getOne(@Param() { id }: MongoIdDto) {
    return await this.recentlyService.getOne(id)
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
      throw new BadRequestException('删除失败，条目不存在')
    }

    return
  }

  /**
   * 表态：点赞，点踩
   */
  @Get('/attitude/:id')
  async attitude(
    @Param() { id }: MongoIdDto,
    @Query() { attitude }: RecentlyAttitudeDto,
    @IpLocation() { ip }: IpRecord,
  ) {
    const result = await this.recentlyService.updateAttitude({
      attitude,
      id,
      ip,
    })
    return {
      code: result,
    }
  }
}
