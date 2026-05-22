import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { OffsetDto } from '~/shared/dto/pager.dto'

import { RecentlyAttitudeDto, RecentlyDto } from './recently.schema'
import { RecentlyService } from './recently.service'
import type { RecentlyModel } from './recently.types'

@ApiController(['recently', 'shorthand'])
export class RecentlyController {
  constructor(private readonly recentlyService: RecentlyService) {}

  @Get('/latest')
  getLatestOne() {
    return this.recentlyService.getLatestOne()
  }

  @Get('/all')
  getAll() {
    return this.recentlyService.getAll()
  }

  @Get('/')
  async getList(@Query() query: OffsetDto) {
    const { before, after, size } = query

    if (before && after) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'you can only choose `before` or `after`',
      })
    }

    return this.recentlyService.getOffset({ before, after, size })
  }

  @Get('/:id')
  getOne(@Param() { id }: EntityIdDto) {
    return this.recentlyService.getOne(id)
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  create(@Body() body: RecentlyDto) {
    return this.recentlyService.create(body as unknown as RecentlyModel)
  }

  @Delete('/:id')
  @Auth()
  async del(@Param() { id }: EntityIdDto) {
    const res = await this.recentlyService.delete(id)
    if (!res) {
      throw createAppException(AppErrorCode.RECENTLY_NOT_FOUND, { id })
    }
  }

  @Put('/:id')
  @Auth()
  async update(@Param() { id }: EntityIdDto, @Body() body: RecentlyDto) {
    const res = await this.recentlyService.update(
      id,
      body as unknown as Partial<RecentlyModel>,
    )
    if (!res) {
      throw createAppException(AppErrorCode.RECENTLY_NOT_FOUND, { id })
    }
    return res
  }

  @Get('/attitude/:id')
  async attitude(
    @Param() { id }: EntityIdDto,
    @Query() { attitude }: RecentlyAttitudeDto,
    @IpLocation() { ip }: IpRecord,
  ) {
    const result = await this.recentlyService.updateAttitude({
      attitude,
      id,
      ip,
    })
    return { code: result }
  }
}
