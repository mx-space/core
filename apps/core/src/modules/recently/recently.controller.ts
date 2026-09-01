import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { OffsetDto, OffsetSchema } from '~/shared/dto/pager.dto'

import {
  RecentlyAttitudeDto,
  RecentlyAttitudeSchema,
  RecentlyDto,
  RecentlyRefCandidatesQueryDto,
  RecentlyRefCandidatesQuerySchema,
  RecentlySchema,
} from './recently.schema'
import { RecentlyService } from './recently.service'
import type { RecentlyCreateModel } from './recently.types'

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
  async getList(@Query({ schema: OffsetSchema }) query: OffsetDto) {
    const { before, after, size } = query

    if (before && after) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'you can only choose `before` or `after`',
      })
    }

    return this.recentlyService.getOffset({ before, after, size })
  }

  @Get('/ref-candidates')
  @Auth()
  getRefCandidates(
    @Query({ schema: RecentlyRefCandidatesQuerySchema })
    query: RecentlyRefCandidatesQueryDto,
  ) {
    return this.recentlyService.getRefCandidates(query.search ?? '', query.size)
  }

  @Get('/:id')
  getOne(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    return this.recentlyService.getOne(id)
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  create(@Body({ schema: RecentlySchema }) body: RecentlyDto) {
    return this.recentlyService.create(body as unknown as RecentlyCreateModel)
  }

  @Delete('/:id')
  @Auth()
  async del(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    const res = await this.recentlyService.delete(id)
    if (!res) {
      throw createAppException(AppErrorCode.RECENTLY_NOT_FOUND, { id })
    }
  }

  @Put('/:id')
  @Auth()
  async update(
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
    @Body({ schema: RecentlySchema }) body: RecentlyDto,
  ) {
    const res = await this.recentlyService.update(
      id,
      body as unknown as RecentlyCreateModel,
    )
    if (!res) {
      throw createAppException(AppErrorCode.RECENTLY_NOT_FOUND, { id })
    }
    return res
  }

  @Post('/attitude/:id')
  @HttpCode(200)
  async attitudePost(
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
    @Query({ schema: RecentlyAttitudeSchema })
    { attitude }: RecentlyAttitudeDto,
    @IpLocation() { ip }: IpRecord,
  ) {
    return this.attitude({ id }, { attitude }, { ip } as IpRecord)
  }

  /**
   * @deprecated state-changing GET kept as an alias for legacy clients
   * (@mx-space/api-client calls this as GET). Prefer POST /attitude/:id.
   */
  @Get('/attitude/:id')
  async attitude(
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
    @Query({ schema: RecentlyAttitudeSchema })
    { attitude }: RecentlyAttitudeDto,
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
