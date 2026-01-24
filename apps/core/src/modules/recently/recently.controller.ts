import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { OffsetDto } from '~/shared/dto/pager.dto'
import { RecentlyModel } from './recently.model'
import { RecentlyAttitudeDto, RecentlyDto } from './recently.schema'
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
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'you can only choose `before` or `after`',
      )
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
  async create(@Body() body: RecentlyDto) {
    const res = await this.recentlyService.create(
      body as unknown as RecentlyModel,
    )

    return res
  }

  @Delete('/:id')
  @Auth()
  async del(@Param() { id }: MongoIdDto) {
    const res = await this.recentlyService.delete(id)
    if (!res) {
      throw new BizException(ErrorCodeEnum.EntryNotFound)
    }

    return
  }

  @Put('/:id')
  @Auth()
  async update(@Param() { id }: MongoIdDto, @Body() body: RecentlyModel) {
    const res = await this.recentlyService.update(id, body)
    if (!res) {
      throw new BizException(ErrorCodeEnum.EntryNotFound)
    }

    return res
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
