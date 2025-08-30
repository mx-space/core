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
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { FastifyBizRequest } from '~/transformers/get-req.transformer'
import { ConfigsService } from '../../configs/configs.service'
import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import {
  GenerateAiSummaryDto,
  GetSummaryQueryDto,
  UpdateSummaryDto,
} from './ai-summary.dto'
import { AiSummaryService } from './ai-summary.service'

@ApiController('ai/summaries')
export class AiSummaryController {
  constructor(
    private readonly service: AiSummaryService,
    private readonly configService: ConfigsService,
  ) {}

  @Post('/generate')
  @Auth()
  generateSummary(@Body() body: GenerateAiSummaryDto) {
    return this.service.generateSummaryByOpenAI(body.refId, body.lang)
  }

  @Get('/ref/:id')
  @Auth()
  async getSummaryByRefId(@Param() params: MongoIdDto) {
    return this.service.getSummariesByRefId(params.id)
  }

  @Get('/')
  @Auth()
  async getSummaries(@Query() query: PagerDto) {
    return this.service.getAllSummaries(query)
  }

  @Patch('/:id')
  @Auth()
  async updateSummary(
    @Param() params: MongoIdDto,
    @Body() body: UpdateSummaryDto,
  ) {
    return this.service.updateSummaryInDb(params.id, body.summary)
  }

  @Delete('/:id')
  @Auth()
  async deleteSummary(@Param() params: MongoIdDto) {
    return this.service.deleteSummaryInDb(params.id)
  }

  @Get('/article/:id')
  async getArticleSummary(
    @Param() params: MongoIdDto,
    @Query() query: GetSummaryQueryDto,
    @Req() req: FastifyBizRequest,
  ) {
    const acceptLang = req.headers['accept-language']
    const nextLang = query.lang || acceptLang
    const autoDetectedLanguage =
      nextLang?.split('-').shift() || DEFAULT_SUMMARY_LANG
    const targetLanguage = await this.configService
      .get('ai')
      .then((c) => c.aiSummaryTargetLanguage)
      .then((targetLanguage) =>
        targetLanguage === 'auto' ? autoDetectedLanguage : targetLanguage,
      )

    const dbStored = await this.service.getSummaryByArticleId(
      params.id,
      targetLanguage,
    )

    const aiConfig = await this.configService.get('ai')
    if (!dbStored && !query.onlyDb) {
      const shouldGenerate =
        aiConfig?.enableAutoGenerateSummary && aiConfig.enableSummary
      if (shouldGenerate) {
        return this.service.generateSummaryByOpenAI(params.id, targetLanguage)
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
