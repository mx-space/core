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
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import {
  GenerateAiSummaryDto,
  GetSummaryQueryDto,
  UpdateSummaryDto,
} from './ai-summary.schema'
import { AiSummaryService } from './ai-summary.service'

@ApiController('ai/summaries')
export class AiSummaryController {
  constructor(private readonly service: AiSummaryService) {}

  @Post('/generate')
  @Auth()
  generateSummary(@Body() body: GenerateAiSummaryDto) {
    return this.service.generateSummaryByOpenAI(body.refId, body.lang!)
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

  @Get('/grouped')
  @Auth()
  async getSummariesGrouped(@Query() query: PagerDto) {
    return this.service.getAllSummariesGrouped(query)
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
    const acceptLanguage = req.headers['accept-language']

    return this.service.getOrGenerateSummaryForArticle(params.id, {
      preferredLang: query.lang,
      acceptLanguage,
      onlyDb: query.onlyDb,
    })
  }
}
