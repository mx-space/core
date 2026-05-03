import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
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
    return this.translationEntryService.generateTranslations(body ?? {})
  }

  @Get('/')
  @Auth()
  async queryEntries(@Query() query: QueryEntriesDto) {
    return this.translationEntryService.findEntries(query)
  }

  @Patch('/:id')
  @Auth()
  async updateEntry(
    @Param() params: EntityIdDto,
    @Body() body: UpdateEntryDto,
  ) {
    return this.translationEntryService.updateEntry(
      params.id,
      body.translatedText,
    )
  }

  @Delete('/:id')
  @Auth()
  async deleteEntry(@Param() params: EntityIdDto) {
    return this.translationEntryService.deleteEntry(params.id)
  }
}
