import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'

import {
  GenerateEntriesDto,
  QueryEntriesDto,
  UpdateEntryDto,
} from './translation-entry.schema'
import { TranslationEntryService } from './translation-entry.service'

@ApiController('ai/translations/entries')
export class TranslationEntryController {
  constructor(
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  @Post('/generate')
  @Auth()
  async generateEntries(@Body() body?: GenerateEntriesDto) {
    const data = await this.translationEntryService.generateTranslations(
      body ?? {},
    )
    return data
  }

  @Get('/')
  @Auth()
  async queryEntries(@Query() query: QueryEntriesDto) {
    const result = await this.translationEntryService.findEntries(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  updateEntry(@Param() params: EntityIdDto, @Body() body: UpdateEntryDto) {
    return this.translationEntryService.updateEntry(
      params.id,
      body.translatedText,
    )
  }

  @Delete('/:id')
  @Auth()
  deleteEntry(@Param() params: EntityIdDto) {
    return this.translationEntryService.deleteEntry(params.id)
  }
}
