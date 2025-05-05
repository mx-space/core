import { Delete, Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { ConfigsService } from '../../configs/configs.service'
import { GetDeepReadingQueryDto } from './ai-deep-reading.dto'
import { AiDeepReadingService } from './ai-deep-reading.service'

@ApiController('ai/deep-readings')
export class AiDeepReadingController {
  constructor(
    private readonly service: AiDeepReadingService,
    private readonly configService: ConfigsService,
  ) {}

  @Get('/')
  @Auth()
  async getDeepReadings(@Query() query: PagerDto) {
    return this.service.getAllDeepReadings(query)
  }

  @Post('/generate/:id')
  @Auth()
  async generateDeepReading(@Param() params: MongoIdDto) {
    return this.service.generateDeepReadingByOpenAI(params.id)
  }

  @Delete('/:id')
  @Auth()
  async deleteDeepReading(@Param() params: MongoIdDto) {
    return this.service.deleteDeepReadingInDb(params.id)
  }

  @Get('/article/:id')
  async getArticleDeepReading(
    @Param() params: MongoIdDto,
    @Query() query: GetDeepReadingQueryDto,
  ) {
    const dbStored = await this.service.getDeepReadingByArticleId(params.id)

    const aiConfig = await this.configService.get('ai')
    if (!dbStored && !query.onlyDb) {
      const shouldGenerate = aiConfig?.enableDeepReading
      if (shouldGenerate) {
        return this.service.generateDeepReadingByOpenAI(params.id)
      }
    }

    if (!dbStored && !aiConfig.enableDeepReading) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    return dbStored
  }
}
