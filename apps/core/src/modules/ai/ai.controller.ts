import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth, AuthButProd } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { FastifyBizRequest } from '~/transformers/get-req.transformer'

import { ConfigsService } from '../configs/configs.service'
import {
  GenerateAiSummaryDto,
  GetSummaryQueryDto,
  UpdateSummaryDto,
} from './ai.dto'
import { AiService } from './ai.service'

@ApiController('ai')
export class AiController {
  constructor(
    private readonly service: AiService,
    private readonly configService: ConfigsService,
  ) {}

  @Post('/generate-summary')
  @Auth()
  generateSummary(@Body() body: GenerateAiSummaryDto) {
    return this.service.generateSummaryByOpenAI(body.refId, body.lang)
  }

  @Get('/summaries/ref/:id')
  @Auth()
  async getSummaryByRefId(@Param() params: MongoIdDto) {
    return this.service.getSummariesByRefId(params.id)
  }

  @Get('/summaries')
  @Auth()
  async getSummaries(@Query() query: PagerDto) {
    return this.service.getAllSummaries(query)
  }

  @Patch('/summaries/:id')
  @Auth()
  async updateSummary(
    @Param() params: MongoIdDto,
    @Body() body: UpdateSummaryDto,
  ) {
    return this.service.updateSummaryInDb(params.id, body.summary)
  }

  @Delete('/summaries/:id')
  @Auth()
  async deleteSummary(@Param() params: MongoIdDto) {
    return this.service.deleteSummaryInDb(params.id)
  }

  @Get('/summaries/article/:id')
  async getArticleSummary(
    @Param() params: MongoIdDto,
    @Query() query: GetSummaryQueryDto,
    @Req() req: FastifyBizRequest,
  ) {
    const acceptLang = req.headers['accept-language']
    const nextLang = query.lang || acceptLang || 'zh-CN'
    const finalLang = nextLang.split('-').shift() || 'zh'

    const dbStored = await this.service.getSummaryByArticleId(
      params.id,
      finalLang,
    )

    const aiConfig = await this.configService.get('ai')
    if (!dbStored && !query.onlyDb) {
      const shouldGenerate =
        aiConfig?.enableAutoGenerateSummary && aiConfig.enableSummary
      if (shouldGenerate) {
        return this.service.generateSummaryByOpenAI(params.id, finalLang)
      }
    }

    if (
      !dbStored &&
      (!aiConfig.enableSummary || !aiConfig.enableAutoGenerateSummary)
    ) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    return dbStored
  }
}
