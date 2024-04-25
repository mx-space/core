import { Body, Get, Param, Post, Query, Req } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { AuthButProd } from '~/common/decorators/auth.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { FastifyBizRequest } from '~/transformers/get-req.transformer'

import { ConfigsService } from '../configs/configs.service'
import { GenerateAiSummaryDto, LangQueryDto } from './ai.dto'
import { AiService } from './ai.service'

@ApiController('ai')
export class AiController {
  constructor(
    private readonly service: AiService,
    private readonly configService: ConfigsService,
  ) {}

  @Post('/generate-summary')
  @AuthButProd()
  generateSummary(@Body() body: GenerateAiSummaryDto) {
    return this.service.generateSummaryByOpenAI(body.refId, body.lang)
  }

  @Get('/summary/:id')
  async getArticleSummary(
    @Param() params: MongoIdDto,
    @Query() query: LangQueryDto,
    @Req() req: FastifyBizRequest,
  ) {
    const acceptLang = req.headers['accept-language']
    const finalLang = query.lang || acceptLang || 'zh-CN'
    const dbStored = await this.service.getSummaryByArticleId(
      params.id,
      finalLang,
    )

    if (!dbStored) {
      const shouldGenerate = await this.configService
        .get('ai')
        .then((config) => {
          return config.enableAutoGenerateSummary && config.enableSummary
        })
      if (shouldGenerate) {
        return this.service.generateSummaryByOpenAI(params.id, finalLang)
      }
    }

    return dbStored
  }
}
