import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import {
  GenerateTranslationAllDto,
  GenerateTranslationBatchDto,
  GenerateTranslationDto,
  GetTranslationQueryDto,
  GetTranslationsGroupedQueryDto,
  UpdateTranslationDto,
} from './ai-translation.schema'
import { AiTranslationService } from './ai-translation.service'

@ApiController('ai/translations')
export class AiTranslationController {
  constructor(private readonly service: AiTranslationService) {}

  @Post('/generate')
  @Auth()
  async generateTranslation(@Body() body: GenerateTranslationDto) {
    return this.service.generateTranslationsForLanguages(
      body.refId,
      body.targetLanguages,
    )
  }

  @Post('/generate/batch')
  @Auth()
  async generateTranslationBatch(@Body() body: GenerateTranslationBatchDto) {
    return this.service.generateTranslationsBatch(
      body.refIds,
      body.targetLanguages,
    )
  }

  @Post('/generate/all')
  @Auth()
  async generateTranslationAll(@Body() body: GenerateTranslationAllDto) {
    return this.service.generateTranslationsForAll(body.targetLanguages)
  }

  @Get('/ref/:id')
  @Auth()
  async getTranslationsByRefId(@Param() params: MongoIdDto) {
    return this.service.getTranslationsByRefId(params.id)
  }

  @Get('/grouped')
  @Auth()
  async getTranslationsGrouped(@Query() query: GetTranslationsGroupedQueryDto) {
    return this.service.getAllTranslationsGrouped(query)
  }

  @Patch('/:id')
  @Auth()
  async updateTranslation(
    @Param() params: MongoIdDto,
    @Body() body: UpdateTranslationDto,
  ) {
    return this.service.updateTranslation(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  async deleteTranslation(@Param() params: MongoIdDto) {
    return this.service.deleteTranslation(params.id)
  }

  @Get('/article/:id')
  async getArticleTranslation(
    @Param() params: MongoIdDto,
    @Query() query: GetTranslationQueryDto,
  ) {
    return this.service.getTranslationForArticle(params.id, query.lang)
  }

  @Get('/article/:id/languages')
  async getAvailableLanguages(@Param() params: MongoIdDto) {
    return this.service.getAvailableLanguagesForArticle(params.id)
  }
}
